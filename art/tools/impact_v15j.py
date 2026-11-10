# v15j: original Blender models of the office lift (frame, leaves, cab, spill, panel, indicator)
# and a banker/anglepoise desk lamp, rendered with the office11 plate camera
# (ortho 8.4, pitch 38, yaw -30, AgX). No third-party meshes.
import bpy, sys, math, os, json
from mathutils import Vector, Euler, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
OUT = argv[0]
SAMPLES = int(argv[1]) if len(argv) > 1 else 48
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
R = math.radians

# ---------- office plate camera (rooms7.py / scene7.py) ----------
O7 = 8.4
PITCH, YAW = 38.0, -30.0
W, H = 1280, 720
T7 = R(90 - PITCH)
Y7 = R(30)
RIGHT = Vector((math.cos(Y7), math.sin(Y7), 0))
UP = Vector((-math.sin(Y7) * math.cos(T7), math.cos(Y7) * math.cos(T7), math.sin(T7)))
PXZ = UP.z * 1280 / O7  # ~120 px per world unit of height


def unproj(sx, sy, z=0.0):
    u = (sx - 640) * O7 / 1280
    v = (360 - sy) * O7 / 1280
    dz = z - 0.5
    a, b, c, d = RIGHT.x, RIGHT.y, UP.x, UP.y
    r1 = u - RIGHT.z * dz
    r2 = v - UP.z * dz
    det = a * d - b * c
    return Vector(((r1 * d - b * r2) / det, (a * r2 - c * r1) / det, z))


def zpx(px):
    return px / PXZ


def away(sx, sy):
    a = unproj(sx, sy)
    b = unproj(sx, sy - 10)
    return (b - a).normalized()


def setup_scene():
    w = bpy.data.worlds.new('w')
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs[0].default_value = (0.010, 0.016, 0.030, 1)
    bg.inputs[1].default_value = 0.35

    # Match the office: cool window fill from the right, warm interior key, soft rim
    def area(name, loc, rot, energy, col, size=1.6, size_y=None):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.color = col
        ld.size = size
        if size_y:
            ld.shape = 'RECTANGLE'
            ld.size_y = size_y
        o = bpy.data.objects.new(name, ld)
        o.location = loc
        o.rotation_euler = rot
        sc.collection.objects.link(o)
        return o

    # Window fill (east / right of plate) — cool
    area('win', unproj(1000, 140, 1.4), (R(80), 0, R(-20)), 90, (0.55, 0.70, 1.0), 3.0, 1.4)
    # Warm office key (overhead-ish)
    area('key', unproj(640, 300, 2.2), (R(0), 0, 0), 70, (1.0, 0.88, 0.72), 4.0)
    # Soft fill
    area('fill', unproj(400, 500, 1.6), (R(40), 0, R(20)), 30, (0.6, 0.72, 0.9), 3.0)

    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    sc.cycles.max_bounces = 6
    sc.cycles.transparent_max_bounces = 16
    sc.render.film_transparent = True
    sc.render.resolution_x = W
    sc.render.resolution_y = H
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.image_settings.color_depth = '8'

    # Camera — identical to scene7.camera()
    cx, cy = unproj(640, 360, 0.5).x, unproj(640, 360, 0.5).y
    cd = bpy.data.cameras.new('cam')
    cd.type = 'ORTHO'
    cd.ortho_scale = O7
    cd.clip_end = 100
    cam = bpy.data.objects.new('cam', cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    t = R(90 - PITCH)
    yw = R(YAW)
    dirv = Vector((math.sin(yw) * math.sin(t), math.cos(yw) * math.sin(t), -math.cos(t)))
    cam.location = Vector((cx, cy, 0.5)) - dirv * 20
    cam.rotation_euler = (t, 0, -yw)


# ---------- materials ----------
def princ(name, col, rough=0.4, metal=0.0, emit=0.0, emit_col=None, aniso=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.blend_method = 'OPAQUE'
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit > 0:
        b.inputs['Emission Color'].default_value = (*(emit_col or col), 1)
        b.inputs['Emission Strength'].default_value = emit
    if aniso > 0:
        try:
            b.inputs['Anisotropic'].default_value = aniso
            b.inputs['Anisotropic Rotation'].default_value = 0.25  # vertical brush
        except KeyError:
            pass
    return m


def brushed_steel(name, col=(0.52, 0.54, 0.58), rough=0.28, metal=0.92):
    """Brushed steel: principled metal + stretched noise on roughness/color."""
    m = princ(name, col, rough=rough, metal=metal, aniso=0.55)
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    tex = nt.nodes.new('ShaderNodeTexNoise')
    tex.inputs['Scale'].default_value = 80.0
    tex.inputs['Detail'].default_value = 8.0
    tex.inputs['Roughness'].default_value = 0.45
    mapping = nt.nodes.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (0.15, 4.0, 0.15)  # vertical grain
    coord = nt.nodes.new('ShaderNodeTexCoord')
    nt.links.new(coord.outputs['Object'], mapping.inputs['Vector'])
    nt.links.new(mapping.outputs['Vector'], tex.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeRamp') if False else nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (0.38, 0.40, 0.44, 1)
    ramp.color_ramp.elements[1].position = 0.7
    ramp.color_ramp.elements[1].color = (0.70, 0.72, 0.76, 1)
    nt.links.new(tex.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    # roughness variation
    mathn = nt.nodes.new('ShaderNodeMath')
    mathn.operation = 'MULTIPLY'
    mathn.inputs[1].default_value = 0.18
    add = nt.nodes.new('ShaderNodeMath')
    add.operation = 'ADD'
    add.inputs[1].default_value = rough
    nt.links.new(tex.outputs['Fac'], mathn.inputs[0])
    nt.links.new(mathn.outputs[0], add.inputs[0])
    nt.links.new(add.outputs[0], b.inputs['Roughness'])
    return m


def box(name, dims, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = dims
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(mat)
    return o


def cyl(name, radius, depth, loc, mat, rot=(0, 0, 0), verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    return o


def group(name, objs):
    col = bpy.data.collections.new(name)
    sc.collection.children.link(col)
    for o in objs:
        if o.name in sc.collection.objects:
            sc.collection.objects.unlink(o)
        col.objects.link(o)
    return col


def hide_all_but(keep):
    for col in sc.collection.children:
        hide = (col.name not in keep)
        for o in col.objects:
            o.hide_render = hide
            o.hide_viewport = hide


def render_layer(name, keep):
    hide_all_but(keep if isinstance(keep, (list, tuple, set)) else [keep])
    path = os.path.join(OUT, name + '.png')
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print('wrote', path, flush=True)
    return path


# ---------- lift geometry ----------
# Opening in screen space (v15i recess); wall-floor at the door ≈ 202
SX0, SX1 = 150.0, 260.0
SY_TOP, SY_BOT, SYF = 81.0, 200.0, 202.0
FRAME_PX = 5.0  # slightly thicker than v15i's 4 so the frame reads in iso


def build_lift():
    steel = brushed_steel('steel', (0.64, 0.66, 0.70), 0.34, 0.86)
    steel_d = brushed_steel('steel_d', (0.50, 0.52, 0.56), 0.42, 0.85)
    steel_hi = princ('steel_hi', (0.82, 0.84, 0.88), 0.18, 0.88)
    seam_m = princ('seam', (0.08, 0.09, 0.10), 0.5, 0.4)
    # cab
    cab_back = princ('cab_back', (0.58, 0.50, 0.40), 0.48)          # warm taupe, lit
    cab_side = princ('cab_side', (0.50, 0.44, 0.36), 0.5)
    cab_floor = princ('cab_floor', (0.42, 0.38, 0.32), 0.4, 0.05)
    cab_ceil = princ('cab_ceil', (0.62, 0.55, 0.45), 0.35, 0.0, emit=0.8, emit_col=(1.0, 0.9, 0.75))
    light_m = princ('clight', (1.0, 0.96, 0.85), 0.2, 0.0, emit=28.0, emit_col=(1.0, 0.95, 0.8))
    rail_m = princ('rail', (0.82, 0.78, 0.62), 0.18, 0.95)
    btn_on = princ('btn1', (0.9, 0.75, 0.3), 0.3, 0.2, emit=4.0, emit_col=(1.0, 0.85, 0.4))
    btn_off = princ('btnd', (0.22, 0.22, 0.24), 0.4, 0.5)
    panel_m = princ('cpanel', (0.28, 0.29, 0.31), 0.35, 0.7)
    thresh_m = princ('th', (0.30, 0.31, 0.33), 0.35, 0.8)

    A = unproj(SX0, SYF)
    B = unproj(SX1, SYF)
    d = B - A
    n = away(SX0, SYF)          # into the wall (away from camera)
    wall_dir = d.normalized()
    width = d.length
    z0 = zpx(SYF - SY_BOT)
    z1 = zpx(SYF - SY_TOP)
    height = z1 - z0
    mid = (A + B) / 2
    rz = math.atan2(d.y, d.x)

    # bounce card in front of the doors so brushed steel reads as metal, not a black cabinet
    card = bpy.data.lights.new('card', 'AREA')
    card.energy = 55
    card.color = (1.0, 0.96, 0.9)
    card.size = 1.8
    card.size_y = 2.2
    card.shape = 'RECTANGLE'
    co = bpy.data.objects.new('card', card)
    aim = mid - n * 0.02
    aim.z = (z0 + z1) / 2
    co.location = mid - n * 1.6
    co.location.z = (z0 + z1) / 2 + 0.3
    # face the lift
    direction = (aim - co.location).normalized()
    co.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    sc.collection.objects.link(co)


    # Frame sits on the front face of the wall
    eps = 0.018
    frame_t = 0.045             # thickness toward camera
    stile = zpx(FRAME_PX + 1)
    # outer frame size
    outer_w = width + 2 * stile
    outer_h = height + 2 * stile
    frame_c = mid - n * eps
    frame_c.z = (z0 + z1) / 2

    def wall_rot(extra=0):
        return (R(90), 0, rz + extra)

    objs_frame = []
    # four stiles as boxes oriented along the wall
    def stile_box(name, sx, sy, sz, loc):
        o = box(name, (sx, sy, sz), loc, steel, rot=(0, 0, rz))
        return o

    # Local frame: X along wall, Y toward camera (-n), Z up
    def at(along, out, z):
        p = mid + wall_dir * along - n * out
        p.z = z
        return p

    # left stile
    objs_frame.append(stile_box('fL', stile, frame_t, outer_h, at(-width / 2 - stile / 2, eps, (z0 + z1) / 2)))
    # right stile
    objs_frame.append(stile_box('fR', stile, frame_t, outer_h, at(width / 2 + stile / 2, eps, (z0 + z1) / 2)))
    # lintel
    objs_frame.append(stile_box('fT', outer_w, frame_t, stile, at(0, eps, z1 + stile / 2)))
    # threshold / sill
    objs_frame.append(stile_box('fB', outer_w, frame_t + 0.02, stile * 0.7, at(0, eps + 0.01, z0 - stile * 0.25)))
    # inner highlight strip on left/top
    objs_frame.append(box('hiL', (0.008, 0.01, height), at(-width / 2 + 0.004, eps + frame_t * 0.6, (z0 + z1) / 2), steel_hi, rot=(0, 0, rz)))
    objs_frame.append(box('hiT', (width, 0.01, 0.008), at(0, eps + frame_t * 0.6, z1 - 0.004), steel_hi, rot=(0, 0, rz)))

    # ---- doors (leaves) — thickness, bevel, centre seam, vertical highlight ----
    leaf_w = width / 2 - 0.005
    leaf_t = 0.035
    leaf_z = (z0 + z1) / 2
    leaf_out = eps + 0.002

    def make_leaf(side):
        sign = -1 if side == 'L' else 1
        along = sign * (leaf_w / 2 + 0.003)
        objs = []
        body = box(f'leaf{side}', (leaf_w, leaf_t, height - 0.01), at(along, leaf_out, leaf_z), steel, rot=(0, 0, rz))
        objs.append(body)
        # vertical brush highlight near the meeting edge
        meet = sign * 0.006
        objs.append(box(f'lvhi{side}', (0.01, 0.008, height - 0.04),
                        at(sign * (0.006 if side == 'L' else -0.006) + along + (leaf_w / 2 - 0.012) * (-sign if side == 'R' else sign) * 0 + sign * (leaf_w / 2 - 0.012) * -1 * 0,
                           leaf_out + leaf_t * 0.55, leaf_z), steel_hi, rot=(0, 0, rz)))
        # redo highlight at the centre seam
        seam_along = sign * 0.008
        objs.append(box(f'seamhi{side}', (0.007, 0.006, height - 0.03),
                        at(seam_along, leaf_out + leaf_t * 0.6, leaf_z), steel_hi, rot=(0, 0, rz)))
        # outer edge darker
        objs.append(box(f'oedge{side}', (0.008, 0.006, height - 0.02),
                        at(sign * (leaf_w - 0.004), leaf_out + leaf_t * 0.4, leaf_z), steel_d, rot=(0, 0, rz)))
        # slim handle recess near centre, mid height
        hx = sign * 0.04
        objs.append(box(f'handle{side}', (0.018, 0.01, 0.11),
                        at(hx, leaf_out + leaf_t * 0.7, leaf_z - 0.02), steel_d, rot=(0, 0, rz)))
        return objs

    # Fix highlight placement more carefully
    def make_leaf2(side):
        sign = -1 if side == 'L' else 1
        along = sign * (leaf_w / 2 + 0.0025)
        objs = []
        objs.append(box(f'leaf{side}', (leaf_w, leaf_t, height - 0.008),
                        at(along, leaf_out, leaf_z), steel, rot=(0, 0, rz)))
        # centre-seam highlight (inner edge)
        objs.append(box(f'shi{side}', (0.008, 0.007, height - 0.03),
                        at(sign * 0.006, leaf_out + leaf_t * 0.62, leaf_z), steel_hi, rot=(0, 0, rz)))
        # mid-panel vertical highlight (brushed catch)
        objs.append(box(f'vhi{side}', (0.012, 0.005, height - 0.06),
                        at(along + sign * (-leaf_w * 0.18), leaf_out + leaf_t * 0.55, leaf_z), steel_hi, rot=(0, 0, rz)))
        # handle
        objs.append(box(f'hwell{side}', (0.016, 0.01, 0.10),
                        at(sign * 0.045, leaf_out + leaf_t * 0.7, z0 + height * 0.48), steel_d, rot=(0, 0, rz)))
        return objs

    leafL = make_leaf2('L')
    leafR = make_leaf2('R')
    # visible centre seam (dark gap)
    seam = box('cseam', (0.008, 0.02, height - 0.02), at(0, leaf_out + 0.01, leaf_z), seam_m, rot=(0, 0, rz))

    # ---- cab (into the wall) ----
    depth = 0.85
    cab_origin = mid + n * (depth / 2 + 0.02)  # into the wall
    cab_origin.z = (z0 + z1) / 2
    objs_cab = []
    # back wall
    objs_cab.append(box('cback', (width - 0.02, 0.04, height - 0.02),
                        at(0, -(depth + 0.02), leaf_z), cab_back, rot=(0, 0, rz)))
    # left / right walls (recede in perspective)
    objs_cab.append(box('cL', (0.04, depth, height - 0.02),
                        at(-width / 2 + 0.02, -(depth / 2 + 0.02), leaf_z), cab_side, rot=(0, 0, rz)))
    objs_cab.append(box('cR', (0.04, depth, height - 0.02),
                        at(width / 2 - 0.02, -(depth / 2 + 0.02), leaf_z), cab_side, rot=(0, 0, rz)))
    # floor
    objs_cab.append(box('cfloor', (width - 0.04, depth, 0.03),
                        at(0, -(depth / 2 + 0.02), z0 + 0.015), cab_floor, rot=(0, 0, rz)))
    # ceiling
    objs_cab.append(box('cceil', (width - 0.04, depth, 0.03),
                        at(0, -(depth / 2 + 0.02), z1 - 0.02), cab_ceil, rot=(0, 0, rz)))
    # recessed warm ceiling light
    objs_cab.append(box('clight', (width * 0.42, depth * 0.35, 0.02),
                        at(0, -(depth * 0.45), z1 - 0.04), light_m, rot=(0, 0, rz)))
    # AREA light in the cab
    lp = at(0, -(depth * 0.4), z1 - 0.08)
    ld = bpy.data.lights.new('cabL', 'AREA')
    ld.energy = 220
    ld.color = (1.0, 0.90, 0.72)
    ld.size = width * 0.4
    ld.size_y = depth * 0.3
    ld.shape = 'RECTANGLE'
    lo = bpy.data.objects.new('cabL', ld)
    lo.location = lp
    lo.rotation_euler = (0, 0, rz)  # faces down-ish; rotate to aim down
    lo.rotation_euler = (R(180), 0, rz)
    sc.collection.objects.link(lo)
    objs_cab.append(lo)
    # handrail on the back wall, mid height
    rail_z = z0 + height * 0.45
    objs_cab.append(cyl('rail', 0.028, width * 0.72, at(0, -(depth + 0.00 - 0.06), rail_z), rail_m,
                        rot=(0, R(90), rz), verts=16))
    # brackets
    for al in (-width * 0.28, width * 0.28):
        objs_cab.append(box(f'rbr{al}', (0.025, 0.06, 0.025),
                            at(al, -(depth - 0.02), rail_z), rail_m, rot=(0, 0, rz)))
    # control panel on left cab wall
    objs_cab.append(box('ctrl', (0.06, 0.02, 0.22),
                        at(-width / 2 + 0.05, -(depth * 0.35), z0 + height * 0.55), panel_m, rot=(0, 0, rz)))
    for i, k in enumerate((0.08, 0.04, 0.0, -0.04, -0.08)):
        matb = btn_on if i == 1 else btn_off
        objs_cab.append(cyl(f'cb{i}', 0.01, 0.015,
                            at(-width / 2 + 0.06, -(depth * 0.33), z0 + height * 0.55 + k),
                            matb, rot=(R(90), 0, rz), verts=12))
    # back-wall vertical seams
    for al in (-width * 0.22, width * 0.22):
        objs_cab.append(box(f'cseam{al}', (0.008, 0.01, height - 0.08),
                            at(al, -(depth + 0.00), leaf_z), princ('csm', (0.28, 0.24, 0.20), 0.6), rot=(0, 0, rz)))
    # floor grooves
    for al in (-width * 0.2, 0, width * 0.2):
        objs_cab.append(box(f'fgro{al}', (0.012, depth - 0.08, 0.008),
                            at(al, -(depth / 2 + 0.02), z0 + 0.032), princ('fg', (0.12, 0.12, 0.12), 0.5), rot=(0, 0, rz)))
    # threshold plate (sits on the wall-floor line, slightly into the room)
    objs_cab.append(box('thresh', (width - 0.02, 0.08, 0.018),
                        at(0, 0.03, z0 + 0.005), thresh_m, rot=(0, 0, rz)))
    # Holdout wall around the opening so the receding ceiling doesn't poke above the lintel
    hold = bpy.data.materials.new('holdout')
    hold.use_nodes = True
    hnt = hold.node_tree
    for node in list(hnt.nodes):
        if node.type != 'OUTPUT_MATERIAL':
            hnt.nodes.remove(node)
    hout = [node for node in hnt.nodes if node.type == 'OUTPUT_MATERIAL'][0]
    hs = hnt.nodes.new('ShaderNodeHoldout')
    hnt.links.new(hs.outputs[0], hout.inputs['Surface'])
    objs_cab.append(box('holdT', (4.0, 0.04, 2.0), at(0, eps + 0.002, z1 + 1.0), hold, rot=(0, 0, rz)))
    objs_cab.append(box('holdL', (2.0, 0.04, 4.0), at(-width / 2 - 1.0, eps + 0.002, (z0 + z1) / 2), hold, rot=(0, 0, rz)))
    objs_cab.append(box('holdR', (2.0, 0.04, 4.0), at(width / 2 + 1.0, eps + 0.002, (z0 + z1) / 2), hold, rot=(0, 0, rz)))

    # ---- spill: warm light on the office floor in front of the door ----
    # A soft emissive+transparent trapezoid on the floor, toward the camera
    spill_m = bpy.data.materials.new('spill')
    spill_m.use_nodes = True
    spill_m.blend_method = 'BLEND'
    try:
        spill_m.shadow_method = 'NONE'
    except Exception:
        pass
    nt = spill_m.node_tree
    for node in list(nt.nodes):
        if node.type != 'OUTPUT_MATERIAL':
            nt.nodes.remove(node)
    out = [n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'][0]
    emit = nt.nodes.new('ShaderNodeEmission')
    emit.inputs['Color'].default_value = (1.0, 0.88, 0.65, 1)
    emit.inputs['Strength'].default_value = 0.85
    trans = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    # gradient along Y (out of the door)
    coord = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(coord.outputs['Generated'], sep.inputs['Vector'])
    # fade from door (Y=1) to room (Y=0)
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0, 0, 0, 0)
    ramp.color_ramp.elements[1].position = 1.0
    ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    # use Y of generated coords
    nt.links.new(sep.outputs['Y'], ramp.inputs['Fac'])
    # also fade at sides (X)
    mathx = nt.nodes.new('ShaderNodeMath')
    mathx.operation = 'ABSOLUTE'
    # Generated X is 0..1, centre 0.5
    sub = nt.nodes.new('ShaderNodeMath')
    sub.operation = 'SUBTRACT'
    sub.inputs[1].default_value = 0.5
    mul2 = nt.nodes.new('ShaderNodeMath')
    mul2.operation = 'MULTIPLY'
    mul2.inputs[1].default_value = 2.0
    # 1 - 2*|x-0.5|
    absn = nt.nodes.new('ShaderNodeMath')
    absn.operation = 'ABSOLUTE'
    one = nt.nodes.new('ShaderNodeMath')
    one.operation = 'SUBTRACT'
    one.inputs[0].default_value = 1.0
    nt.links.new(sep.outputs['X'], sub.inputs[0])
    nt.links.new(sub.outputs[0], absn.inputs[0])
    nt.links.new(absn.outputs[0], mul2.inputs[0])
    nt.links.new(mul2.outputs[0], one.inputs[1])
    mulg = nt.nodes.new('ShaderNodeMath')
    mulg.operation = 'MULTIPLY'
    nt.links.new(ramp.outputs['Color'], mulg.inputs[0])
    # ramp Color is RGB; use a separate fac from Y already in ramp. Use Fac via a second ramp? Simpler: use ramp as fac.
    # Actually ValToRGB Color; take from Fac path: use ramp element as strength.
    # Reconnect: Y -> ramp, ramp color -> mix fac * side fade
    inv = nt.nodes.new('ShaderNodeMath')
    inv.operation = 'MULTIPLY'
    nt.links.new(one.outputs[0], inv.inputs[0])
    # ramp.fac is Y; we'll use a MapRange on Y for fac
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = 0.05
    mr.inputs['From Max'].default_value = 0.95
    mr.inputs['To Min'].default_value = 0.0
    mr.inputs['To Max'].default_value = 0.55
    nt.links.new(sep.outputs['Y'], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], inv.inputs[1])
    nt.links.new(inv.outputs[0], mix.inputs['Fac'])
    nt.links.new(trans.outputs['BSDF'], mix.inputs[1])
    nt.links.new(emit.outputs['Emission'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])

    spill_len = 0.55
    spill = box('spill', (width * 1.15, spill_len, 0.002),
                at(0, spill_len / 2 + 0.04, 0.004), spill_m, rot=(0, 0, rz))
    # Generated Y may not align; rotate so "out of door" is +Y in object space.
    # box local Y is along -n after rot z=rz? cube with rot z=rz: local Y is rotated.
    # We'll leave it; can tweak if the fade is wrong.

    # ---- indicator housing above the lintel ----
    ind_m = princ('indh', (0.22, 0.24, 0.26), 0.35, 0.7)
    ind_off = princ('indoff', (0.08, 0.09, 0.10), 0.4)
    ind_on = princ('indon', (0.25, 0.85, 0.4), 0.3, 0.0, emit=6.0, emit_col=(0.45, 1.0, 0.55))
    objs_ind_off = []
    objs_ind_on = []
    house = box('indhouse', (0.16, 0.04, 0.07), at(0, eps + 0.02, z1 + stile + 0.05), ind_m, rot=(0, 0, rz))
    screen_off = box('indscr_off', (0.12, 0.01, 0.045), at(0, eps + 0.042, z1 + stile + 0.05), ind_off, rot=(0, 0, rz))
    screen_on = box('indscr_on', (0.12, 0.01, 0.045), at(0, eps + 0.042, z1 + stile + 0.05), ind_on, rot=(0, 0, rz))
    # tiny "1" as a thin box
    glyph = box('ind1', (0.012, 0.008, 0.03), at(0, eps + 0.05, z1 + stile + 0.05),
                princ('g1', (0.9, 1.0, 0.9), 0.3, 0.0, emit=8.0, emit_col=(0.85, 1.0, 0.85)), rot=(0, 0, rz))
    objs_ind_off = [house, screen_off]
    objs_ind_on = [house, screen_on, glyph]

    # ---- call panel on the wall, right of the frame ----
    # screen center (276, 164), 16x24 → sx 268-284, sy 152-176, syf 202
    pA = unproj(268, SYF)
    pB = unproj(284, SYF)
    pw = (pB - pA).length
    pz0 = zpx(SYF - 176)
    pz1 = zpx(SYF - 152)
    pmid = (pA + pB) / 2
    p_at = lambda along, out, z: (lambda p: p)((lambda q: q)(type('P', (), {}) ))  # placeholder

    def pat(along, out, z):
        p = pmid + wall_dir * along - n * out
        p.z = z
        return p

    plate_m = brushed_steel('psteel', (0.42, 0.44, 0.48), 0.32, 0.9)
    plate_d = princ('pdark', (0.12, 0.13, 0.14), 0.45, 0.4)
    btn_dead = princ('pbd', (0.18, 0.19, 0.20), 0.4, 0.5)
    btn_live = princ('pbl', (0.2, 0.7, 0.35), 0.3, 0.1, emit=3.5, emit_col=(0.3, 0.95, 0.45))
    slit_d = princ('slitd', (0.06, 0.07, 0.07), 0.5)
    slit_l = princ('slitl', (0.15, 0.45, 0.22), 0.3, 0.0, emit=2.0, emit_col=(0.3, 0.8, 0.4))

    def make_panel(live):
        objs = []
        objs.append(box('pbody', (pw, 0.02, pz1 - pz0), pat(0, eps + 0.01, (pz0 + pz1) / 2), plate_m, rot=(0, 0, rz)))
        objs.append(box('pslit', (pw * 0.55, 0.008, (pz1 - pz0) * 0.18),
                        pat(0, eps + 0.022, pz1 - (pz1 - pz0) * 0.28), slit_l if live else slit_d, rot=(0, 0, rz)))
        objs.append(cyl('pbtn', 0.018, 0.016, pat(0, eps + 0.024, pz0 + (pz1 - pz0) * 0.32),
                        btn_live if live else btn_dead, rot=(R(90), 0, rz), verts=16))
        return objs

    panel_dead = make_panel(False)
    # live panel shares space — we'll duplicate positions; build live as a second set with different names
    # Rebuild live separately after hiding dead at render time: store both, they overlap. OK if we hide collections.

    # Rebuild live with unique names
    def make_panel2(suffix, live):
        objs = []
        objs.append(box(f'pbody{suffix}', (pw, 0.02, pz1 - pz0), pat(0, eps + 0.01, (pz0 + pz1) / 2), plate_m, rot=(0, 0, rz)))
        objs.append(box(f'pslit{suffix}', (pw * 0.55, 0.008, (pz1 - pz0) * 0.18),
                        pat(0, eps + 0.022, pz1 - (pz1 - pz0) * 0.28), slit_l if live else slit_d, rot=(0, 0, rz)))
        objs.append(cyl(f'pbtn{suffix}', 0.018, 0.016, pat(0, eps + 0.024, pz0 + (pz1 - pz0) * 0.32),
                        btn_live if live else btn_dead, rot=(R(90), 0, rz), verts=16))
        return objs

    # remove first panel_dead from scene to avoid doubles? We already created panel_dead. Hide later by collection.
    panel_live = make_panel2('_L', True)

    group('frame', objs_frame)
    group('leaf_l', leafL)
    group('leaf_r', leafR)
    group('seam', [seam])
    group('cab', [o for o in objs_cab])
    group('spill', [spill])
    group('ind_off', objs_ind_off)
    group('ind_on', objs_ind_on)
    group('panel_dead', panel_dead)
    group('panel_live', panel_live)

    return dict(width=width, height=height, z0=z0, z1=z1, rz=rz, mid=mid)


def build_lamp():
    # Banker + anglepoise: weighted oval base, two brass arms, green glass cowl, warm bulb.
    brass = princ('brass', (0.62, 0.48, 0.22), 0.28, 0.9)
    brass_d = princ('brassd', (0.40, 0.30, 0.14), 0.4, 0.85)
    green = princ('gshade', (0.18, 0.38, 0.20), 0.22, 0.05)
    green_in = princ('gshin', (0.85, 0.75, 0.45), 0.4, 0.0, emit=2.5, emit_col=(1.0, 0.9, 0.65))
    green_in_off = princ('gshin_off', (0.25, 0.22, 0.16), 0.55)
    felt = princ('felt', (0.12, 0.10, 0.08), 0.8)
    bulb_on = princ('bulb', (1.0, 0.95, 0.8), 0.2, 0.0, emit=16.0, emit_col=(1.0, 0.95, 0.8))
    bulb_off = princ('bulboff', (0.6, 0.58, 0.5), 0.35)

    # Place on desk_podW top. Screen: lamp base (178, 291), desk top ~0.70-0.75m
    Z = 0.72
    base = unproj(178, 291, Z)
    # Face slightly toward the lift / camera-right so the shade is readable
    yaw = R(SCR if False else 30)  # objects face camera with SCR_RZ=30
    # Actually rotate the lamp so the shade leans toward the aisle (southeast-ish)
    rz = R(30 - 20)

    objs_on, objs_off = [], []

    def parts(on):
        objs = []
        # felt pad + brass oval base (scale y for oval)
        pad = cyl('pad', 0.10, 0.012, (base.x, base.y, Z + 0.004), felt, verts=32)
        objs.append(pad)
        b1 = cyl('base', 0.095, 0.022, (base.x, base.y, Z + 0.014), brass_d, verts=32)
        b1.scale = (1.25, 0.9, 1)
        objs.append(b1)
        b2 = cyl('base2', 0.055, 0.016, (base.x, base.y, Z + 0.026), brass, verts=24)
        objs.append(b2)
        # upright post
        post = cyl('post', 0.014, 0.16, (base.x, base.y, Z + 0.12), brass, verts=16)
        objs.append(post)
        # lower arm pivot
        j1 = cyl('j1', 0.022, 0.036, (base.x, base.y, Z + 0.20), brass, rot=(R(90), 0, rz + R(90)), verts=16)
        objs.append(j1)
        # lower arm (leans toward +away from wall, into the room)
        arm_dir = Euler((0, R(-35), rz), 'XYZ')
        # place arm by rotation
        arm1 = cyl('arm1', 0.008, 0.16, (0, 0, 0), brass, verts=14)
        arm1.rotation_euler = (R(70), 0, rz + R(15))
        # position so the bottom sits at the joint
        bpy.context.view_layer.update()
        # simpler: set location at midpoint of arm
        # joint at base+(0,0,0.13); arm points up-right
        import math as _m
        pitch = R(70)
        length = 0.32
        # Blender cylinder default is along Z; rot (70, 0, rz+15) tilts it
        # Midpoint offset: rotation matrix * (0,0,length/2)
        e = Euler((R(70), 0, rz + R(15)), 'XYZ')
        mid = Vector((base.x, base.y, Z + 0.20)) + (e.to_matrix() @ Vector((0, 0, length / 2)))
        arm1.location = mid
        objs.append(arm1)
        elbow_pos = Vector((base.x, base.y, Z + 0.20)) + (e.to_matrix() @ Vector((0, 0, length)))
        j2 = cyl('j2', 0.014, 0.024, elbow_pos, brass, rot=(0, R(90), rz + R(15)), verts=16)
        objs.append(j2)
        # upper arm, more horizontal, toward desk front / slightly left
        e2 = Euler((R(40), 0, rz + R(25)), 'XYZ')
        length2 = 0.26
        mid2 = elbow_pos + (e2.to_matrix() @ Vector((0, 0, length2 / 2)))
        arm2 = cyl('arm2', 0.007, length2, mid2, brass, verts=14)
        arm2.rotation_euler = e2
        objs.append(arm2)
        shade_pos = elbow_pos + (e2.to_matrix() @ Vector((0, 0, length2)))
        # banker cowl: truncated cone, open downward, slight tilt
        shade_rot = Euler((R(20), 0, rz + R(25)), 'XYZ')
        bpy.ops.mesh.primitive_cone_add(vertices=28, radius1=0.15, radius2=0.045, depth=0.14,
                                        location=shade_pos + Vector((0, 0, 0.01)),
                                        rotation=(R(20), 0, rz + R(25)))
        sh = bpy.context.object
        sh.data.materials.append(green)
        objs.append(sh)
        # inner shade (emissive when on)
        bpy.ops.mesh.primitive_cone_add(vertices=28, radius1=0.138, radius2=0.04, depth=0.12,
                                        location=shade_pos + Vector((0, 0, 0.005)),
                                        rotation=(R(20), 0, rz + R(25)))
        inn = bpy.context.object
        inn.data.materials.append(green_in if on else green_in_off)
        objs.append(inn)
        # bulb
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.036, location=shade_pos + Vector((0, 0, -0.01)))
        bu = bpy.context.object
        bu.data.materials.append(bulb_on if on else bulb_off)
        objs.append(bu)
        if on:
            ld = bpy.data.lights.new('lampL', 'POINT')
            ld.energy = 22
            ld.color = (1.0, 0.88, 0.65)
            ld.shadow_soft_size = 0.04
            lo = bpy.data.objects.new('lampL', ld)
            lo.location = shade_pos + Vector((0, 0, -0.02))
            sc.collection.objects.link(lo)
            objs.append(lo)
        return objs, shade_pos

    # We'll build ON first, render, then OFF in a second clear... easier to build both in collections
    # But they overlap in space. Two collections, hide one.
    # Build ON
    on_objs, shade_pos = parts(True)
    # Mark them and move to collection before building OFF? OFF would overlap.
    # Render ON first from this function by grouping, then delete lamp objects and rebuild OFF.
    return on_objs, shade_pos


def set_border(x0, y0, x1, y1):
    sc.render.use_border = True
    sc.render.use_crop_to_border = False
    sc.render.border_min_x = x0 / W
    sc.render.border_max_x = x1 / W
    sc.render.border_min_y = 1 - y1 / H
    sc.render.border_max_y = 1 - y0 / H


def main():
    setup_scene()
    info = build_lift()

    # Render lift layers (border around the recess + spill)
    set_border(120, 50, 360, 360)
    render_layer('raw_frame', ['frame'])
    render_layer('raw_leaf_l', ['leaf_l', 'seam'])  # seam with left for closed look? seam is separate
    # Re-render leaves without seam, seam only when both closed in-game (or bake seam into both at the meeting edge)
    render_layer('raw_leaf_l', ['leaf_l'])
    render_layer('raw_leaf_r', ['leaf_r'])
    render_layer('raw_seam', ['seam'])
    render_layer('raw_cab', ['cab'])
    render_layer('raw_spill', ['spill'])
    render_layer('raw_ind_off', ['ind_off'])
    render_layer('raw_ind_on', ['ind_on'])
    render_layer('raw_panel_dead', ['panel_dead'])
    render_layer('raw_panel_live', ['panel_live'])
    # closed composite preview (not shipped as a layer)
    render_layer('raw_closed', ['frame', 'leaf_l', 'leaf_r', 'seam', 'ind_off', 'panel_dead'])
    render_layer('raw_open', ['frame', 'cab', 'spill', 'ind_on', 'panel_live'])

    # Lamp: clear lift, build lamp
    # Hide all lift collections
    hide_all_but([])
    on_objs, shade_pos = build_lamp()
    group('lamp_on', [o for o in on_objs if o.type == 'MESH'] + [o for o in on_objs if o.type == 'LIGHT'])
    set_border(120, 180, 280, 400)
    render_layer('raw_lamp_on', ['lamp_on'])

    # Rebuild off: delete on meshes/lights and rebuild
    for o in list(on_objs):
        bpy.data.objects.remove(o, do_unlink=True)
    # parts() was only called for on. Call a local off build:
    # Easier: duplicate the script path — call build_lamp_off inline
    # Re-import by running parts logic: we'll just darken by rebuilding via a second function
    # Instead, set emissions to 0 and lights off... objects already deleted.
    # Recreate with a monkey-patch: temporarily... just write a compact off build.

    # Minimal: rerun build by exec of a flag
    # I'll construct off here by calling build_lamp after adding a global
    # Actually build_lamp always builds ON. Let's add lamp off quickly:

    # After deletion, call a simplified copy — invoke build_lamp after setting a scene flag
    sc['lamp_on'] = 0

    # Re-define quickly using the same function if I change it... I'll inline a dim copy
    # For robustness, we'll render off in a second blender invocation if needed.
    # Let's inline:

    Z = 0.72
    base = unproj(178, 291, Z)
    rz = R(10)
    brass = bpy.data.materials.get('brass')
    brass_d = bpy.data.materials.get('brassd')
    felt = bpy.data.materials.get('felt')
    green = bpy.data.materials.get('gshade')
    green_in_off = bpy.data.materials.get('gshin_off')
    bulb_off = bpy.data.materials.get('bulboff')
    objs = []
    objs.append(cyl('pad2', 0.10, 0.012, (base.x, base.y, Z + 0.004), felt, verts=32))
    b1 = cyl('baseo', 0.095, 0.022, (base.x, base.y, Z + 0.014), brass_d, verts=32)
    b1.scale = (1.25, 0.9, 1)
    objs.append(b1)
    objs.append(cyl('base2o', 0.055, 0.016, (base.x, base.y, Z + 0.026), brass, verts=24))
    objs.append(cyl('posto', 0.014, 0.16, (base.x, base.y, Z + 0.12), brass, verts=16))
    objs.append(cyl('j1o', 0.022, 0.036, (base.x, base.y, Z + 0.20), brass, rot=(R(90), 0, rz + R(90)), verts=16))
    e = Euler((R(70), 0, rz + R(15)), 'XYZ')
    mid = Vector((base.x, base.y, Z + 0.20)) + (e.to_matrix() @ Vector((0, 0, 0.32)))
    arm1 = cyl('arm1o', 0.011, 0.32, mid, brass, verts=14)
    arm1.rotation_euler = e
    objs.append(arm1)
    elbow_pos = Vector((base.x, base.y, Z + 0.20)) + (e.to_matrix() @ Vector((0, 0, 0.32)))
    objs.append(cyl('j2o', 0.020, 0.032, elbow_pos, brass, rot=(0, R(90), rz + R(15)), verts=16))
    e2 = Euler((R(40), 0, rz + R(25)), 'XYZ')
    mid2 = elbow_pos + (e2.to_matrix() @ Vector((0, 0, 0.26)))
    arm2 = cyl('arm2o', 0.010, 0.26, mid2, brass, verts=14)
    arm2.rotation_euler = e2
    objs.append(arm2)
    shade_pos = elbow_pos + (e2.to_matrix() @ Vector((0, 0, 0.26)))
    bpy.ops.mesh.primitive_cone_add(vertices=28, radius1=0.15, radius2=0.045, depth=0.14,
                                    location=shade_pos + Vector((0, 0, 0.01)), rotation=(R(20), 0, rz + R(25)))
    sh = bpy.context.object
    sh.data.materials.append(green)
    objs.append(sh)
    bpy.ops.mesh.primitive_cone_add(vertices=28, radius1=0.138, radius2=0.04, depth=0.12,
                                    location=shade_pos + Vector((0, 0, 0.005)), rotation=(R(20), 0, rz + R(25)))
    inn = bpy.context.object
    inn.data.materials.append(green_in_off)
    objs.append(inn)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.036, location=shade_pos + Vector((0, 0, -0.01)))
    bu = bpy.context.object
    bu.data.materials.append(bulb_off)
    objs.append(bu)
    group('lamp_off', objs)
    set_border(120, 180, 280, 400)
    render_layer('raw_lamp_off', ['lamp_off'])

    meta = dict(camera=dict(ortho=O7, pitch=PITCH, yaw=YAW, pxz=PXZ),
                lamp_base=dict(sx=178, sy=291, z=0.72))
    with open(os.path.join(OUT, 'meta_raw.json'), 'w') as f:
        json.dump(meta, f, indent=2)
    print('DONE', OUT)


if __name__ == '__main__':
    main()
