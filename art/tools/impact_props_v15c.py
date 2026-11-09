# v15c: custom desk lamp (arm+shade), flush steel panel, lift cab. Bound-framed.
import bpy, sys, math, os
from mathutils import Vector, Euler

argv = sys.argv[sys.argv.index('--') + 1:]
OUT = argv[0]; SAMPLES = int(argv[1]) if len(argv) > 1 else 64
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; R = math.radians

def clear():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for b in list(bpy.data.meshes): bpy.data.meshes.remove(b)
    for m in list(bpy.data.materials): bpy.data.materials.remove(m)
    for c in list(bpy.data.cameras): bpy.data.cameras.remove(c)
    for l in list(bpy.data.lights): bpy.data.lights.remove(l)

def Mmetal(n, c=(0.45,0.48,0.52), r=0.35, m=0.85):
    mat = bpy.data.materials.new(n); mat.use_nodes = True
    b = mat.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*c, 1); b.inputs['Roughness'].default_value = r; b.inputs['Metallic'].default_value = m
    return mat
def Memit(n, c, s=5.0):
    mat = bpy.data.materials.new(n); mat.use_nodes = True
    b = mat.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*c, 1)
    b.inputs['Emission Color'].default_value = (*c, 1); b.inputs['Emission Strength'].default_value = s
    return mat
def Mplas(n, c, r=0.55):
    mat = bpy.data.materials.new(n); mat.use_nodes = True
    b = mat.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*c, 1); b.inputs['Roughness'].default_value = r
    return mat

def box(name, dims, loc, mat, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = dims
    bpy.ops.object.transform_apply(scale=True); o.data.materials.append(mat); return o

def cyl(name, r, depth, loc, mat, rot=(0,0,0), verts=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; o.data.materials.append(mat); return o

def setup_lights():
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.012, 0.018, 0.028, 1)
    w.node_tree.nodes['Background'].inputs[1].default_value = 0.25
    def L(n, loc, e, col, size=1.4):
        ld = bpy.data.lights.new(n, 'AREA'); ld.energy = e; ld.color = col; ld.size = size
        o = bpy.data.objects.new(n, ld); o.location = loc; sc.collection.objects.link(o)
    L('key', (1.4, -1.8, 2.2), 130, (1.0, 0.88, 0.72), 1.5)
    L('fill', (-1.6, -0.9, 1.3), 45, (0.5, 0.65, 1.0), 2.0)
    L('rim', (0.3, 1.6, 1.6), 55, (0.65, 0.8, 1.0), 1.2)
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True; sc.render.film_transparent = True
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
    sc.render.image_settings.color_mode = 'RGBA'; sc.render.image_settings.file_format = 'PNG'

def frame_objects(objs, res=256, pad=1.4, yaw=-28, pitch=38):
    bpy.context.view_layer.update()
    coords = []
    for o in objs:
        if o.type != 'MESH': continue
        for c in o.bound_box: coords.append(o.matrix_world @ Vector(c))
    if not coords: return
    mn = Vector(tuple(min(c[i] for c in coords) for i in range(3)))
    mx = Vector(tuple(max(c[i] for c in coords) for i in range(3)))
    center = (mn + mx) / 2; size = max((mx - mn).length, 0.1)
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = size * pad; cd.clip_end = 100
    cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
    e = Euler((R(90 - pitch), 0, R(yaw)), 'XYZ')
    forward = e.to_matrix() @ Vector((0, 0, -1))
    cam.rotation_euler = e; cam.location = center - forward * (size * 3 + 2)
    sc.render.resolution_x = sc.render.resolution_y = res

def render_to(path):
    sc.render.filepath = path; bpy.ops.render.render(write_still=True); print('wrote', path)

# ---- Articulated desk lamp (base + jointed arm + conical shade + bulb) ----
def render_lamp(on=True):
    clear(); setup_lights()
    metal = Mmetal('m', (0.55, 0.57, 0.6), 0.3, 0.9)
    metal_d = Mmetal('md', (0.3, 0.32, 0.35), 0.4, 0.85)
    shade_c = (0.85, 0.72, 0.45) if on else (0.45, 0.42, 0.38)
    shade = Mplas('shade', shade_c, 0.55)
    objs = []
    # Weighted oval base
    objs.append(cyl('base', 0.09, 0.025, (0, 0, 0.012), metal_d, verts=24))
    objs.append(cyl('base2', 0.06, 0.02, (0, 0, 0.028), metal, verts=20))
    # Lower arm (angled toward camera-right)
    objs.append(cyl('arm1', 0.012, 0.22, (0.05, -0.02, 0.14), metal, rot=(R(70), 0, R(35))))
    # Elbow joint
    objs.append(cyl('joint', 0.022, 0.03, (0.1, -0.04, 0.24), metal, rot=(0, R(90), R(35))))
    # Upper arm
    objs.append(cyl('arm2', 0.011, 0.16, (0.14, -0.06, 0.34), metal, rot=(R(50), 0, R(40))))
    # Shade hinge
    objs.append(cyl('hinge', 0.018, 0.028, (0.18, -0.08, 0.42), metal, rot=(0, R(90), R(40))))
    # Conical shade (truncated cone via scaled cylinder)
    bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=0.11, radius2=0.05, depth=0.1,
        location=(0.18, -0.08, 0.48), rotation=(R(25), 0, R(40)))
    sh = bpy.context.object; sh.name = 'shade'; sh.data.materials.append(shade); objs.append(sh)
    # Inner shade darker
    bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=0.095, radius2=0.04, depth=0.08,
        location=(0.18, -0.08, 0.475), rotation=(R(25), 0, R(40)))
    inn = bpy.context.object
    inn.data.materials.append(Mplas('inner', (0.15, 0.12, 0.08) if on else (0.1, 0.1, 0.1), 0.8))
    objs.append(inn)
    # Bulb
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.028, location=(0.18, -0.08, 0.45))
    bulb = bpy.context.object
    bulb.data.materials.append(Memit('bulb', (1.0, 0.95, 0.75), 12.0 if on else 0.05))
    objs.append(bulb)
    if on:
        ld = bpy.data.lights.new('loc', 'POINT'); ld.energy = 22; ld.color = (1.0, 0.85, 0.55)
        lo = bpy.data.objects.new('loc', ld); lo.location = (0.18, -0.08, 0.45); sc.collection.objects.link(lo)
        # Tiny spark points as emissive spheres
        for dx, dy, dz in [(0.06, 0.02, 0.08), (-0.05, 0.03, 0.06), (0.02, -0.05, 0.1)]:
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.006, location=(0.18+dx, -0.08+dy, 0.48+dz))
            sp = bpy.context.object; sp.data.materials.append(Memit('sp', (1.0, 0.9, 0.5), 8.0)); objs.append(sp)
    frame_objects(objs, res=220, pad=1.35, yaw=-30, pitch=38)
    render_to(os.path.join(OUT, f"lamp_{'on' if on else 'off'}.png"))

# ---- Flush steel wall plate ----
def render_panel(state='dead'):
    clear(); setup_lights()
    steel = Mmetal('s', (0.5, 0.52, 0.55), 0.35, 0.92)
    steel_d = Mmetal('sd', (0.28, 0.3, 0.33), 0.45, 0.88)
    hi = Mmetal('hi', (0.7, 0.72, 0.75), 0.25, 0.95)
    objs = []
    # Main plate
    objs.append(box('plate', (0.16, 0.02, 0.28), (0, 0, 0.14), steel))
    # Bevel / rim (slightly larger behind + highlight edge)
    objs.append(box('back', (0.17, 0.012, 0.29), (0, -0.014, 0.14), steel_d))
    objs.append(box('edge', (0.162, 0.006, 0.01), (0, 0.012, 0.275), hi))  # top highlight
    objs.append(box('edgeL', (0.008, 0.006, 0.28), (-0.078, 0.012, 0.14), hi))
    if state == 'live':
        scr = Memit('scr', (0.1, 0.75, 0.35), 3.5)
        btn = Memit('btn', (0.35, 1.0, 0.5), 7.0)
        glow = Memit('glow', (0.2, 0.9, 0.45), 1.8)
        objs.append(box('glow', (0.175, 0.008, 0.295), (0, 0.014, 0.14), glow))
    elif state == 'cracked':
        scr = Mplas('scr', (0.1, 0.11, 0.12)); btn = Mplas('btn', (0.3, 0.32, 0.34))
    else:
        scr = Mplas('scr', (0.05, 0.055, 0.06)); btn = Mmetal('btn', (0.35, 0.37, 0.4), 0.4)
    # Recessed screen well
    objs.append(box('well', (0.1, 0.01, 0.07), (0, 0.008, 0.19), steel_d))
    objs.append(box('scr', (0.085, 0.012, 0.055), (0, 0.016, 0.19), scr))
    # Call button
    objs.append(cyl('btn', 0.028, 0.02, (0, 0.018, 0.09), btn, rot=(R(90), 0, 0), verts=16))
    # Center icon diamond on button
    if state == 'live':
        objs.append(box('ico', (0.012, 0.008, 0.012), (0, 0.028, 0.09), Memit('ico', (0.9, 1.0, 0.95), 4)))
    # Screws
    for dx, dz in [(-0.06, 0.11), (0.06, 0.11), (-0.06, -0.11), (0.06, -0.11)]:
        objs.append(cyl(f's{dx}{dz}', 0.006, 0.01, (dx, 0.014, 0.14+dz), steel_d, rot=(R(90),0,0), verts=8))
    if state == 'cracked':
        objs.append(box('ck', (0.006, 0.022, 0.18), (0.03, 0.02, 0.14), Mplas('ck', (0.85,0.9,0.95), 0.2), rot=(0, R(18), 0)))
    # Drop shadow
    objs.append(box('sh', (0.18, 0.006, 0.3), (0.02, -0.022, 0.13), Mplas('sh', (0.02,0.025,0.03), 1)))
    frame_objects(objs, res=180, pad=1.3, yaw=-22, pitch=36)
    render_to(os.path.join(OUT, f'panel_{state}.png'))

# ---- Lift cab with visible ceiling light, rail, buttons, floor ----
def render_lift_cab():
    clear(); setup_lights()
    wall = Mplas('w', (0.82, 0.78, 0.68), 0.55)
    wall_d = Mplas('wd', (0.62, 0.58, 0.5), 0.6)
    floor_m = Mplas('f', (0.42, 0.43, 0.45), 0.45)
    ceil_m = Mplas('c', (0.88, 0.85, 0.78), 0.4)
    rail_m = Mmetal('r', (0.8, 0.82, 0.85), 0.2, 0.95)
    light_m = Memit('cl', (1.0, 0.97, 0.9), 16)
    panel_m = Mmetal('p', (0.4, 0.42, 0.45), 0.35, 0.75)
    objs = []
    objs.append(box('back', (1.7, 0.06, 2.5), (0, 0.9, 1.25), wall))
    objs.append(box('left', (0.06, 1.2, 2.5), (-0.85, 0.3, 1.25), wall_d))
    objs.append(box('right', (0.06, 1.2, 2.5), (0.85, 0.3, 1.25), wall_d))
    objs.append(box('floor', (1.7, 1.2, 0.06), (0, 0.3, 0.03), floor_m))
    objs.append(box('ceil', (1.7, 1.2, 0.06), (0, 0.3, 2.47), ceil_m))
    # Ceiling light (recessed panel)
    objs.append(box('clight', (0.6, 0.3, 0.05), (0, 0.25, 2.4), light_m))
    ld = bpy.data.lights.new('cab', 'AREA'); ld.energy = 120; ld.color = (1.0, 0.94, 0.82); ld.size = 0.55
    lo = bpy.data.objects.new('cab', ld); lo.location = (0, 0.2, 2.35); sc.collection.objects.link(lo)
    # Handrail
    objs.append(cyl('rail', 0.032, 1.3, (0.7, 0.2, 1.05), rail_m, rot=(R(90), 0, 0)))
    for z in (0.8, 1.3):
        objs.append(box(f'br{z}', (0.05, 0.12, 0.05), (0.75, 0.75, z), rail_m))
    # Control panel on left
    objs.append(box('ctrl', (0.12, 0.05, 0.45), (-0.76, 0.45, 1.3), panel_m))
    for i, z in enumerate((1.45, 1.35, 1.25, 1.15, 1.05)):
        objs.append(cyl(f'b{i}', 0.018, 0.03, (-0.7, 0.5, z), 
            Memit(f'b{i}', (1.0, 0.88, 0.35) if i == 1 else (0.3, 0.32, 0.35), 4.0 if i == 1 else 0.2),
            rot=(R(90), 0, 0), verts=12))
    # Mirror
    objs.append(box('mir', (0.6, 0.03, 1.1), (0, 0.86, 1.55), Mmetal('mir', (0.72, 0.74, 0.76), 0.1, 1.0)))
    # Floor seams
    g = Mplas('g', (0.32, 0.33, 0.35), 0.55)
    for x in (-0.45, 0, 0.45):
        objs.append(box(f'gr{x}', (0.025, 1.0, 0.015), (x, 0.25, 0.06), g))
    # Threshold plate
    objs.append(box('th', (1.65, 0.12, 0.05), (0, -0.25, 0.03), Mmetal('th', (0.28, 0.29, 0.31))))
    # Wall panel seams on back
    for x in (-0.4, 0.4):
        objs.append(box(f'seam{x}', (0.02, 0.04, 2.3), (x, 0.88, 1.25), Mplas('sm', (0.7, 0.66, 0.58), 0.6)))
    frame_objects(objs, res=360, pad=1.15, yaw=-16, pitch=30)
    render_to(os.path.join(OUT, 'lift_cab.png'))

print('lamp on'); render_lamp(True)
print('lamp off'); render_lamp(False)
print('panel dead'); render_panel('dead')
print('panel live'); render_panel('live')
print('panel cracked'); render_panel('cracked')
print('lift cab'); render_lift_cab()
print('DONE', OUT)
