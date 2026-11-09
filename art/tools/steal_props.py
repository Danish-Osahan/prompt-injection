# Steal-qualities v2 props: heavy chains+padlock, dense wind ribbon, wet curtains.
# Same 38° ortho / AgX / transparent film as noor12. Usage:
#   blender -b --python steal_props.py -- OUTDIR [SAMPLES]
# Writes alpha PNGs under OUTDIR/. Keep sheets ≤4096 wide (we emit frame stacks, not atlas).
import bpy, sys, math, os, json
from mathutils import Vector, Matrix, Quaternion, Euler
argv = sys.argv[sys.argv.index('--')+1:]
OUT = argv[0]; SAMPLES = int(argv[1]) if len(argv) > 1 else 32
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; R = math.radians
FRAME = 384; SS = 1  # props at 1x display size (384); composite scales
PX_PER_UNIT = 1280/8.4; ORTHO = FRAME/PX_PER_UNIT; FOOT_Y = 280

def clear():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for b in list(bpy.data.meshes): bpy.data.meshes.remove(b)
    for c in list(bpy.data.curves): bpy.data.curves.remove(c)
    for m in list(bpy.data.materials): bpy.data.materials.remove(m)
    for c in list(bpy.data.cameras): bpy.data.cameras.remove(c)
    for l in list(bpy.data.lights): bpy.data.lights.remove(l)

def setup_cam(foot_y=FOOT_Y, ortho=ORTHO, res=FRAME):
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.008, 0.012, 0.022, 1)
    w.node_tree.nodes['Background'].inputs[1].default_value = 0.15
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = ortho
    cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
    t = R(90-38); cam.rotation_euler = (t, 0, 0)
    d = Vector((0, math.sin(t), -math.cos(t)))
    up = Vector((0, math.cos(t), math.sin(t)))
    off = (foot_y - res/2)/PX_PER_UNIT
    cam.location = Vector((0, 0, 0)) - d*12 + up*off
    # key + fill + rim (match noor neon-noir soft)
    def L(name, loc, energy, color, typ='AREA', size=1.2):
        ld = bpy.data.lights.new(name, typ); ld.energy = energy; ld.color = color
        if typ=='AREA': ld.size = size
        o = bpy.data.objects.new(name, ld); o.location = loc; sc.collection.objects.link(o)
        return o
    L('key', (2.2, -3.0, 4.5), 180, (1.0, 0.92, 0.85), 'AREA', 2.0)
    L('fill', (-2.5, -1.5, 2.0), 40, (0.55, 0.7, 1.0), 'AREA', 2.5)
    L('rim', (0.2, 2.5, 2.8), 90, (0.7, 0.85, 1.0), 'AREA', 1.5)
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True; sc.cycles.max_bounces = 6; sc.cycles.transparent_max_bounces = 16
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = res
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
    sc.render.image_settings.color_mode = 'RGBA'; sc.render.image_settings.file_format = 'PNG'

def mat_metal(name, col=(0.55,0.58,0.62), rough=0.28, metal=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*col, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    return m

def mat_emit(name, col, strength=4.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*col, 1)
    bsdf.inputs['Emission Color'].default_value = (*col, 1)
    bsdf.inputs['Emission Strength'].default_value = strength
    bsdf.inputs['Roughness'].default_value = 0.35
    return m

def mat_cloth(name, col, rough=0.85):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*col, 1)
    bsdf.inputs['Roughness'].default_value = rough
    return m

def mat_wind(name):
    m = bpy.data.materials.new(name); m.use_nodes = True; m.blend_method = 'BLEND'
    try: m.shadow_method = 'NONE'
    except Exception: pass
    nt = m.node_tree; nodes = nt.nodes; links = nt.links
    for n in list(nodes):
        if n.type != 'OUTPUT_MATERIAL': nodes.remove(n)
    out = nodes['Material Output']
    em = nodes.new('ShaderNodeEmission'); em.inputs['Color'].default_value = (0.55, 0.85, 1.0, 1); em.inputs['Strength'].default_value = 6.0
    tr = nodes.new('ShaderNodeBsdfTransparent'); tr.inputs['Color'].default_value = (1,1,1,1)
    mix = nodes.new('ShaderNodeMixShader')
    # fresnel-ish edge via Layer Weight
    lw = nodes.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.35
    links.new(lw.outputs['Fresnel'], mix.inputs['Fac'])
    links.new(tr.outputs[0], mix.inputs[1]); links.new(em.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], out.inputs['Surface'])
    return m

def render(path):
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print('saved', path)

# ---------- CHAINS + PADLOCK ----------
def build_chain_link(metal, major=0.055, minor=0.012):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=28, minor_segments=12)
    o = bpy.context.object; o.data.materials.append(metal); bpy.ops.object.shade_smooth()
    return o

def make_hanging_chains(pad_on=True, sway=0.0, drop=0.0, snap=0.0):
    """Build heavy chains across a door-scale prop. snap 0..1 flings links; drop lowers padlock."""
    clear(); setup_cam(foot_y=220, ortho=ORTHO*1.15, res=FRAME)
    metal = mat_metal('chain', (0.62, 0.66, 0.72), rough=0.22)
    dark = mat_metal('pad', (0.12, 0.10, 0.10), rough=0.45, metal=0.85)
    led = mat_emit('led', (1.0, 0.12, 0.08), 28.0)
    objs = []
    # two vertical strands + one cross
    strands = [
        # (anchor_x, anchor_z, n_links, tilt_deg, phase)
        (-0.28, 0.95, 8, 8, 0.0),
        ( 0.28, 0.95, 8, -8, 0.4),
        (-0.22, 0.55, 7, 92, 0.2),  # cross
    ]
    rng = 7
    for si, (ax, az, n, tilt, ph) in enumerate(strands):
        for i in range(n):
            link = build_chain_link(metal, major=0.05, minor=0.013)
            # hanging direction
            if abs(tilt) < 45:
                # vertical
                dx = math.sin(R(tilt)) * 0.02 * i + sway * 0.04 * math.sin(ph + i*0.5)
                x = ax + dx
                z = az - i * 0.085 - drop * (0.02 if si < 2 else 0)
                y = 0.0 + sway * 0.02 * math.cos(ph + i*0.4)
                rot = (R(90 if i%2 else 0), R(tilt*0.3), R(i*12 + sway*20))
            else:
                x = ax + i * 0.078
                z = az + math.sin(i*0.4)*0.01 + sway*0.015
                y = 0.0
                rot = (R(90 if i%2 else 10), R(0), R(tilt))
            # snap flings
            if snap > 0:
                ang = (si*2.1 + i*0.7)
                x += math.cos(ang) * snap * (0.15 + 0.08*i)
                z += math.sin(ang)*0.5 * snap * (0.1 + 0.05*i) - snap * snap * 0.35 * i
                y += math.sin(ang*1.3) * snap * 0.2
                rot = (R(90+snap*80*i), R(snap*60), R(tilt + snap*120*i))
            link.location = (x, y, z); link.rotation_euler = rot
            link.scale = (1.15, 1.15, 1.15)  # exaggerate for game scale
            objs.append(link)
    pad = None
    if pad_on and snap < 0.85:
        # padlock body
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.02, 0.42 - drop*0.5 - snap*0.6))
        body = bpy.context.object; body.scale = (0.11, 0.06, 0.095); body.data.materials.append(dark)
        # shackle
        bpy.ops.mesh.primitive_torus_add(major_radius=0.055, minor_radius=0.01, location=(0, 0.02, 0.50 - drop*0.5 - snap*0.6),
                                        rotation=(R(90), 0, 0))
        sh = bpy.context.object; sh.scale = (0.7, 1.0, 0.85); sh.data.materials.append(dark)
        # red LED
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.018, location=(0.0, 0.055, 0.40 - drop*0.5 - snap*0.6))
        led_o = bpy.context.object; led_o.data.materials.append(led)
        # point light for glow
        ld = bpy.data.lights.new('ledL', 'POINT'); ld.energy = 18; ld.color = (1.0, 0.15, 0.08); ld.shadow_soft_size = 0.05
        lo = bpy.data.objects.new('ledL', ld); lo.location = (0, 0.08, 0.40 - drop*0.5); sc.collection.objects.link(lo)
        if snap > 0.15:
            for o in (body, sh, led_o, lo):
                o.rotation_euler = (R(snap*70), R(snap*40), R(snap*90))
                o.location = (o.location.x + snap*0.25, o.location.y, o.location.z - snap*0.35)
        pad = body
    return objs

def render_chains():
    # hanging sway 0..3, then snap 0..9, then padlock drop alone 0..5
    frames = []
    for i, sway in enumerate([0.0, 0.35, -0.2, 0.15]):
        make_hanging_chains(pad_on=True, sway=sway, drop=0, snap=0)
        p = os.path.join(OUT, 'chain_hang_%02d.png' % i); render(p); frames.append(p)
    for i in range(10):
        u = i/9.0
        # ease-in snap
        s = u*u
        make_hanging_chains(pad_on=True, sway=0, drop=0, snap=s)
        p = os.path.join(OUT, 'chain_snap_%02d.png' % i); render(p); frames.append(p)
    # padlock falling alone (after chains gone)
    for i in range(6):
        clear(); setup_cam(foot_y=220, ortho=ORTHO*1.15, res=FRAME)
        dark = mat_metal('pad', (0.12, 0.10, 0.10), rough=0.45, metal=0.85)
        led = mat_emit('led', (1.0, 0.12, 0.08), 20.0)
        z = 0.55 - i*0.18; spin = i*35
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.05*i, 0.02, z)); body=bpy.context.object
        body.scale=(0.11,0.06,0.095); body.rotation_euler=(R(spin),R(spin*0.6),R(spin*0.3)); body.data.materials.append(dark)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.055, minor_radius=0.01, location=(0.05*i,0.02,z+0.08), rotation=(R(90+spin),0,R(spin)))
        sh=bpy.context.object; sh.scale=(0.7,1,0.85); sh.data.materials.append(dark)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.018, location=(0.05*i, 0.055, z-0.02))
        led_o=bpy.context.object; led_o.data.materials.append(led)
        p = os.path.join(OUT, 'pad_fall_%02d.png' % i); render(p); frames.append(p)
    return frames

# ---------- WIND RIBBON ----------
def make_ribbon_curve(pts, bevel=0.018, extrude=0.0):
    curve = bpy.data.curves.new('ribbon', 'CURVE'); curve.dimensions = '3D'
    curve.bevel_depth = bevel; curve.bevel_resolution = 4; curve.fill_mode = 'FULL'
    if extrude: curve.extrude = extrude
    sp = curve.splines.new('NURBS'); sp.points.add(len(pts)-1)
    for i,p in enumerate(pts):
        sp.points[i].co = (p[0], p[1], p[2], 1.0)
    sp.use_endpoint_u = True; sp.order_u = min(4, len(pts))
    o = bpy.data.objects.new('ribbon', curve); sc.collection.objects.link(o)
    return o

def ribbon_wrap_pts(t, turns=1.6, radius=0.09, length=0.55):
    """Dense helix wrapping a forearm axis (along +X), t animates phase."""
    pts = []
    n = 28
    for i in range(n):
        u = i/(n-1)
        ang = u * turns * 2*math.pi + t*2.2
        # taper radius
        r = radius * (0.7 + 0.4*math.sin(u*math.pi)) * (1.0 + 0.08*math.sin(t*3+u*4))
        x = (u - 0.5) * length
        y = math.cos(ang) * r
        z = 0.55 + math.sin(ang) * r * 0.85
        pts.append((x, y, z))
    return pts

def ribbon_fly_pts(u, from_hand=(0,0,0.55), to_door=(-1.8, 0.2, 0.7)):
    """Bezier flight of ribbon from hand to door; u 0..1."""
    # control points for a ribbon arc
    mid = ((from_hand[0]+to_door[0])*0.5, -0.4, max(from_hand[2], to_door[2])+0.45)
    # sample along path, ribbon has length trailing behind tip
    tip_u = u
    def bez(a,b,c,t):
        return tuple((1-t)*(1-t)*a[i] + 2*(1-t)*t*b[i] + t*t*c[i] for i in range(3))
    pts = []
    n = 22
    trail = 0.22  # trailing length in param
    for i in range(n):
        v = tip_u - trail * (1 - i/(n-1))
        v = max(0.0, min(1.0, v))
        p = bez(from_hand, mid, to_door, v)
        # slight curl
        curl = math.sin(i*0.6 + u*6) * 0.04 * (1-u*0.5)
        pts.append((p[0], p[1]+curl, p[2]+curl*0.5))
    return pts

def render_ribbons():
    frames = []
    wind = None
    # wrap around forearm (8 frames)
    for i in range(8):
        clear(); setup_cam(foot_y=240, ortho=ORTHO*0.95, res=FRAME)
        wind = mat_wind('wind')
        # forearm stand-in (hidden almost — just for occlusion feel, dark)
        skin = mat_cloth('skin', (0.45, 0.32, 0.28), 0.7)
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.055, depth=0.5, location=(0,0,0.55), rotation=(0,R(90),0))
        arm = bpy.context.object; arm.data.materials.append(skin); arm.hide_render = True  # Noor provides arm; ribbon alone
        pts = ribbon_wrap_pts(i/7.0 * math.pi*2, turns=1.85, radius=0.10, length=0.62)
        rib = make_ribbon_curve(pts, bevel=0.022)
        rib.data.materials.append(wind)
        # secondary thinner ribbon
        pts2 = ribbon_wrap_pts(i/7.0 * math.pi*2 + 1.2, turns=1.5, radius=0.07, length=0.5)
        rib2 = make_ribbon_curve(pts2, bevel=0.012)
        rib2.data.materials.append(wind)
        # soft glow light
        ld = bpy.data.lights.new('wg', 'POINT'); ld.energy = 25; ld.color = (0.5, 0.8, 1.0)
        lo = bpy.data.objects.new('wg', ld); lo.location = (0, -0.15, 0.55); sc.collection.objects.link(lo)
        p = os.path.join(OUT, 'ribbon_wrap_%02d.png' % i); render(p); frames.append(p)
    # flight 0..11
    for i in range(12):
        clear(); setup_cam(foot_y=240, ortho=ORTHO*1.6, res=FRAME)  # wider to see flight
        wind = mat_wind('wind')
        u = i/11.0
        pts = ribbon_fly_pts(u)
        rib = make_ribbon_curve(pts, bevel=0.020 + 0.008*(1-u))
        rib.data.materials.append(wind)
        # twin trail
        pts2 = ribbon_fly_pts(max(0, u-0.06))
        # offset twin
        pts2 = [(p[0], p[1]-0.03, p[2]+0.02) for p in pts2]
        rib2 = make_ribbon_curve(pts2, bevel=0.010)
        rib2.data.materials.append(wind)
        ld = bpy.data.lights.new('wg', 'POINT'); ld.energy = 30; ld.color = (0.5, 0.85, 1.0)
        tip = pts[-1]; lo = bpy.data.objects.new('wg', ld); lo.location = tip; sc.collection.objects.link(lo)
        p = os.path.join(OUT, 'ribbon_fly_%02d.png' % i); render(p); frames.append(p)
    return frames

# ---------- CURTAINS (blowing / hanging) ----------
def make_curtain(side='L', blow=0.0, wet=True):
    # side L = left panel, R = right. blow 0=hanging, 1=full blow-in
    cloth = mat_cloth('curt', (0.12, 0.16, 0.22) if wet else (0.14, 0.18, 0.24), rough=0.9)
    # build a subdivided plane and displace as cloth-like folds
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0,0,0.55), rotation=(R(90),0,0))
    o = bpy.context.object
    o.scale = (0.22, 1, 0.55)
    bpy.ops.object.transform_apply(scale=True)
    # subdivide
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.subdivide(number_cuts=10); bpy.ops.object.mode_set(mode='OBJECT')
    mesh = o.data
    # displace verts for folds + blow
    import bmesh
    bm = bmesh.new(); bm.from_mesh(mesh); bm.verts.ensure_lookup_table()
    sign = -1 if side=='L' else 1
    for v in bm.verts:
        # local: x across, y up after rot? plane was XY then rot X90 -> X across, -Y depth, Z up roughly
        x,y,z = v.co
        fold = 0.018 * math.sin(z*18 + x*6) + 0.012 * math.sin(z*9)
        # blow: push bottom into room (+Y in our cam = toward? cam looks -Y-ish). Use -Y as into room for 38deg.
        into = -blow * (0.05 + 0.55 * max(0, (0.55 - z)/0.55)**1.2) * (0.6 + 0.4*math.sin(z*7 + blow*3))
        sway = blow * 0.08 * math.sin(z*5 + blow*2) * sign
        v.co.x = x + sway + fold*sign
        v.co.y = y + into
        v.co.z = z
    bm.to_mesh(mesh); bm.free()
    o.data.materials.append(cloth)
    # wet sheen strip
    if wet and blow > 0.2:
        wetm = mat_emit('wet', (0.35, 0.55, 0.65), 0.6)
        bpy.ops.mesh.primitive_plane_add(size=1, location=(sign*0.05, -0.02 - blow*0.15, 0.15), rotation=(R(90),0,R(sign*8)))
        w = bpy.context.object; w.scale=(0.08,1,0.25); w.data.materials.append(wetm)
    return o

def render_curtains():
    frames = []
    for i, blow in enumerate([1.0, 0.85, 1.0, 0.7, 0.95, 0.8]):  # blowing loop
        clear(); setup_cam(foot_y=200, ortho=ORTHO*1.3, res=FRAME)
        # two panels with gap
        L = make_curtain('L', blow=blow, wet=True); L.location = (-0.28, 0, 0)
        R = make_curtain('R', blow=blow*0.9, wet=True); R.location = (0.28, 0, 0)
        p = os.path.join(OUT, 'curt_blow_%02d.png' % i); render(p); frames.append(p)
    for i, blow in enumerate([0.7, 0.4, 0.15, 0.0, 0.0, 0.0]):  # drop/slam settle
        clear(); setup_cam(foot_y=200, ortho=ORTHO*1.3, res=FRAME)
        L = make_curtain('L', blow=blow, wet=blow>0.2); L.location = (-0.28, 0, 0)
        R = make_curtain('R', blow=blow*0.9, wet=blow>0.2); R.location = (0.28, 0, 0)
        p = os.path.join(OUT, 'curt_drop_%02d.png' % i); render(p); frames.append(p)
    return frames

# ---------- RAIN STREAKS sheet (dense, for window) ----------
def render_rain():
    frames = []
    for i in range(6):
        clear(); setup_cam(foot_y=200, ortho=ORTHO*1.4, res=FRAME)
        rainm = mat_emit('rain', (0.65, 0.82, 0.92), 3.5)
        # many thin cylinders as streaks
        import random; random.seed(11+i)
        for k in range(40):
            x = (random.random()-0.5)*1.4
            z = 0.2 + random.random()*0.9
            y = -0.1 - random.random()*0.3
            length = 0.08 + random.random()*0.18
            bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.004, depth=length,
                location=(x, y, z), rotation=(R(18), R(-12), 0))
            o = bpy.context.object; o.data.materials.append(rainm)
        p = os.path.join(OUT, 'rain_%02d.png' % i); render(p); frames.append(p)
    return frames

META = {}
print('=== chains ==='); META['chains'] = render_chains()
print('=== ribbons ==='); META['ribbons'] = render_ribbons()
print('=== curtains ==='); META['curtains'] = render_curtains()
print('=== rain ==='); META['rain'] = render_rain()
json.dump({k: [os.path.basename(p) for p in v] for k,v in META.items()}, open(os.path.join(OUT,'meta_props.json'),'w'), indent=1)
print('DONE steal_props')
