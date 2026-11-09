# Fix pass: thicker denser wind ribbon + curtains without wet-sheen pillars.
import bpy, sys, math, os
from mathutils import Vector
argv = sys.argv[sys.argv.index('--')+1:]
OUT = argv[0]; SAMPLES = int(argv[1]) if len(argv) > 1 else 24
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; R = math.radians
FRAME = 512  # larger sheet so ribbon/curtains read at game scale
PX_PER_UNIT = 1280/8.4; ORTHO = FRAME/PX_PER_UNIT

def clear():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for b in list(bpy.data.meshes): bpy.data.meshes.remove(b)
    for c in list(bpy.data.curves): bpy.data.curves.remove(c)
    for m in list(bpy.data.materials): bpy.data.materials.remove(m)
    for c in list(bpy.data.cameras): bpy.data.cameras.remove(c)
    for l in list(bpy.data.lights): bpy.data.lights.remove(l)
    for w in list(bpy.data.worlds): bpy.data.worlds.remove(w)

def setup_cam(foot_y=260, ortho=None, res=FRAME):
    if ortho is None: ortho = res/PX_PER_UNIT
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.008, 0.012, 0.022, 1)
    w.node_tree.nodes['Background'].inputs[1].default_value = 0.12
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = ortho
    cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
    t = R(90-38); cam.rotation_euler = (t, 0, 0)
    d = Vector((0, math.sin(t), -math.cos(t)))
    up = Vector((0, math.cos(t), math.sin(t)))
    off = (foot_y - res/2)/PX_PER_UNIT
    cam.location = Vector((0, 0, 0)) - d*12 + up*off
    def L(name, loc, energy, color, size=2.0):
        ld = bpy.data.lights.new(name, 'AREA'); ld.energy = energy; ld.color = color; ld.size = size
        o = bpy.data.objects.new(name, ld); o.location = loc; sc.collection.objects.link(o)
    L('key', (2.2, -3.0, 4.5), 200, (1.0, 0.92, 0.85))
    L('fill', (-2.5, -1.5, 2.0), 50, (0.55, 0.7, 1.0), 2.5)
    L('rim', (0.2, 2.5, 2.8), 100, (0.7, 0.85, 1.0), 1.5)
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True; sc.cycles.max_bounces = 6
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = res
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
    sc.render.image_settings.color_mode = 'RGBA'; sc.render.image_settings.file_format = 'PNG'

def mat_wind():
    m = bpy.data.materials.new('wind'); m.use_nodes = True
    try: m.blend_method = 'HASHED'
    except Exception: pass
    nt = m.node_tree; nodes = nt.nodes; links = nt.links
    for n in list(nodes):
        if n.type != 'OUTPUT_MATERIAL': nodes.remove(n)
    out = nodes['Material Output']
    # Principled with strong emission + alpha-ish via transparent mix on fresnel
    em = nodes.new('ShaderNodeEmission'); em.inputs['Color'].default_value = (0.62, 0.90, 1.0, 1); em.inputs['Strength'].default_value = 8.0
    gloss = nodes.new('ShaderNodeBsdfPrincipled')
    gloss.inputs['Base Color'].default_value = (0.45, 0.75, 0.95, 1)
    gloss.inputs['Roughness'].default_value = 0.25
    gloss.inputs['Metallic'].default_value = 0.15
    gloss.inputs['Emission Color'].default_value = (0.5, 0.85, 1.0, 1)
    gloss.inputs['Emission Strength'].default_value = 3.5
    add = nodes.new('ShaderNodeAddShader')
    links.new(gloss.outputs[0], add.inputs[0]); links.new(em.outputs[0], add.inputs[1])
    links.new(add.outputs[0], out.inputs['Surface'])
    return m

def mat_cloth(col):
    m = bpy.data.materials.new('curt'); m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*col, 1)
    bsdf.inputs['Roughness'].default_value = 0.9
    return m

def make_ribbon(pts, bevel):
    curve = bpy.data.curves.new('ribbon', 'CURVE'); curve.dimensions = '3D'
    curve.bevel_depth = bevel; curve.bevel_resolution = 6; curve.fill_mode = 'FULL'
    sp = curve.splines.new('NURBS'); sp.points.add(len(pts)-1)
    for i,p in enumerate(pts):
        sp.points[i].co = (p[0], p[1], p[2], 1.0)
    sp.use_endpoint_u = True; sp.order_u = min(4, len(pts))
    o = bpy.data.objects.new('ribbon', curve); sc.collection.objects.link(o)
    return o

def wrap_pts(t, turns=2.4, radius=0.13, length=0.72):
    pts = []; n = 36
    for i in range(n):
        u = i/(n-1)
        ang = u * turns * 2*math.pi + t
        r = radius * (0.75 + 0.35*math.sin(u*math.pi)) * (1.0 + 0.1*math.sin(t*2+u*5))
        x = (u - 0.5) * length
        y = math.cos(ang) * r
        z = 0.55 + math.sin(ang) * r * 0.9
        pts.append((x, y, z))
    return pts

def fly_pts(u):
    frm=(0.9,0.0,0.55); mid=(0.0,-0.55,1.05); to=(-1.6,0.15,0.75)
    def bez(a,b,c,t):
        return tuple((1-t)*(1-t)*a[i]+2*(1-t)*t*b[i]+t*t*c[i] for i in range(3))
    pts=[]; n=28; trail=0.28
    for i in range(n):
        v = max(0.0, min(1.0, u - trail*(1-i/(n-1))))
        p = bez(frm, mid, to, v)
        curl = math.sin(i*0.55 + u*7) * 0.055 * (1-u*0.4)
        pts.append((p[0], p[1]+curl, p[2]+curl*0.4))
    return pts

def render(path):
    sc.render.filepath = path; bpy.ops.render.render(write_still=True); print('saved', path)

# ribbons
for i in range(8):
    clear(); setup_cam(foot_y=250, res=FRAME)
    wind = mat_wind()
    t = i/7.0 * math.pi*2
    for k, (turns, rad, length, bev, phase) in enumerate([
        (2.5, 0.14, 0.75, 0.032, 0.0),
        (2.0, 0.10, 0.62, 0.020, 1.4),
        (1.6, 0.075, 0.50, 0.014, 2.5),
    ]):
        rib = make_ribbon(wrap_pts(t+phase, turns=turns, radius=rad, length=length), bev)
        rib.data.materials.append(wind)
    ld = bpy.data.lights.new('wg','POINT'); ld.energy=40; ld.color=(0.55,0.85,1.0)
    lo=bpy.data.objects.new('wg',ld); lo.location=(0,-0.2,0.55); sc.collection.objects.link(lo)
    render(os.path.join(OUT, 'ribbon_wrap_%02d.png'%i))

for i in range(12):
    clear(); setup_cam(foot_y=250, ortho=FRAME/PX_PER_UNIT*1.5, res=FRAME)
    wind = mat_wind(); u=i/11.0
    rib = make_ribbon(fly_pts(u), 0.028 + 0.012*(1-u)); rib.data.materials.append(wind)
    rib2 = make_ribbon([(p[0], p[1]-0.04, p[2]+0.025) for p in fly_pts(max(0,u-0.05))], 0.016)
    rib2.data.materials.append(wind)
    tip = fly_pts(u)[-1]
    ld=bpy.data.lights.new('wg','POINT'); ld.energy=45; ld.color=(0.55,0.9,1.0)
    lo=bpy.data.objects.new('wg',ld); lo.location=tip; sc.collection.objects.link(lo)
    render(os.path.join(OUT, 'ribbon_fly_%02d.png'%i))

# curtains (no wet pillars)
import bmesh
def make_curtain(side, blow):
    cloth = mat_cloth((0.13, 0.17, 0.24))
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0,0,0.55), rotation=(R(90),0,0))
    o = bpy.context.object; o.scale=(0.28,1,0.62); bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.subdivide(number_cuts=14); bpy.ops.object.mode_set(mode='OBJECT')
    bm=bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
    sign = -1 if side=='L' else 1
    for v in bm.verts:
        x,y,z = v.co
        fold = 0.022*math.sin(z*16 + x*5) + 0.014*math.sin(z*8)
        into = -blow * (0.04 + 0.65 * max(0,(0.55-z)/0.55)**1.15) * (0.55+0.45*math.sin(z*6+blow*3))
        sway = blow * 0.10 * math.sin(z*5 + blow*2) * sign
        v.co.x = x + sway + fold*sign; v.co.y = y + into
    bm.to_mesh(o.data); bm.free(); o.data.materials.append(cloth)
    return o

for i, blow in enumerate([1.0, 0.88, 1.0, 0.75, 0.95, 0.82]):
    clear(); setup_cam(foot_y=200, ortho=FRAME/PX_PER_UNIT*1.25, res=FRAME)
    L=make_curtain('L', blow); L.location=(-0.32,0,0)
    Rr=make_curtain('R', blow*0.92); Rr.location=(0.32,0,0)
    render(os.path.join(OUT, 'curt_blow_%02d.png'%i))
for i, blow in enumerate([0.7, 0.4, 0.15, 0.0, 0.0, 0.0]):
    clear(); setup_cam(foot_y=200, ortho=FRAME/PX_PER_UNIT*1.25, res=FRAME)
    L=make_curtain('L', blow); L.location=(-0.32,0,0)
    Rr=make_curtain('R', blow*0.9); Rr.location=(0.32,0,0)
    render(os.path.join(OUT, 'curt_drop_%02d.png'%i))

# also bigger chain hang for readability
def mat_metal(name, col, rough=0.22, metal=1.0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=(*col,1); b.inputs['Roughness'].default_value=rough; b.inputs['Metallic'].default_value=metal
    return m
def mat_emit(name, col, s=28):
    m=bpy.data.materials.new(name); m.use_nodes=True
    b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=(*col,1)
    b.inputs['Emission Color'].default_value=(*col,1); b.inputs['Emission Strength'].default_value=s
    return m

for i, sway in enumerate([0.0, 0.4, -0.25, 0.2]):
    clear(); setup_cam(foot_y=230, ortho=FRAME/PX_PER_UNIT*1.05, res=FRAME)
    metal=mat_metal('c',(0.65,0.68,0.74),0.18); dark=mat_metal('p',(0.12,0.1,0.1),0.45,0.85); led=mat_emit('l',(1.0,0.12,0.08),32)
    strands=[(-0.32,1.05,9,10,0.0),(0.32,1.05,9,-10,0.4),(-0.26,0.58,8,92,0.2)]
    for si,(ax,az,n,tilt,ph) in enumerate(strands):
        for j in range(n):
            bpy.ops.mesh.primitive_torus_add(major_radius=0.058, minor_radius=0.015, major_segments=28, minor_segments=12)
            link=bpy.context.object; link.data.materials.append(metal); bpy.ops.object.shade_smooth()
            if abs(tilt)<45:
                dx=math.sin(R(tilt))*0.02*j + sway*0.05*math.sin(ph+j*0.5)
                x=ax+dx; z=az-j*0.095; y=sway*0.025*math.cos(ph+j*0.4)
                rot=(R(90 if j%2 else 0), R(tilt*0.3), R(j*12+sway*25))
            else:
                x=ax+j*0.09; z=az+math.sin(j*0.4)*0.012; y=0; rot=(R(90 if j%2 else 10),0,R(tilt))
            link.location=(x,y,z); link.rotation_euler=rot; link.scale=(1.25,1.25,1.25)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0,0.03,0.40)); body=bpy.context.object
    body.scale=(0.13,0.07,0.11); body.data.materials.append(dark)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.065, minor_radius=0.012, location=(0,0.03,0.50), rotation=(R(90),0,0))
    sh=bpy.context.object; sh.scale=(0.72,1.0,0.88); sh.data.materials.append(dark)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.022, location=(0,0.07,0.38)); lo=bpy.context.object; lo.data.materials.append(led)
    ld=bpy.data.lights.new('ledL','POINT'); ld.energy=25; ld.color=(1.0,0.15,0.08)
    lo2=bpy.data.objects.new('ledL',ld); lo2.location=(0,0.1,0.38); sc.collection.objects.link(lo2)
    render(os.path.join(OUT, 'chain_hang_%02d.png'%i))

print('DONE fix')
