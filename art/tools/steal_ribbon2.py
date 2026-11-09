# Face-on dense wind ribbon sheets (readable at game scale).
import bpy, sys, math, os
from mathutils import Vector
argv = sys.argv[sys.argv.index('--')+1:]
OUT = argv[0]; SAMPLES = int(argv[1]) if len(argv) > 1 else 28
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; R = math.radians
FRAME = 512; PX = 1280/8.4

def clear():
    for coll in (bpy.data.objects, bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.worlds):
        for o in list(coll): coll.remove(o, do_unlink=True) if hasattr(coll,'remove') else None
    # safer:
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)

def setup(res=FRAME, ortho_mul=1.0, foot=256):
    for w in list(bpy.data.worlds): bpy.data.worlds.remove(w)
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.006,0.01,0.02,1)
    w.node_tree.nodes['Background'].inputs[1].default_value = 0.1
    for c in list(bpy.data.cameras): bpy.data.cameras.remove(c)
    for l in list(bpy.data.lights): bpy.data.lights.remove(l)
    cd = bpy.data.cameras.new('cam'); cd.type='ORTHO'; cd.ortho_scale = (res/PX)*ortho_mul
    cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
    # More frontal for FX readability: 55° elevation (less top-down)
    elev = 55; t = R(90-elev); cam.rotation_euler = (t, 0, 0)
    d = Vector((0, math.sin(t), -math.cos(t))); up = Vector((0, math.cos(t), math.sin(t)))
    off = (foot - res/2)/PX
    cam.location = Vector((0,0,0)) - d*14 + up*off
    def L(n,loc,e,col,sz=2):
        ld=bpy.data.lights.new(n,'AREA'); ld.energy=e; ld.color=col; ld.size=sz
        o=bpy.data.objects.new(n,ld); o.location=loc; sc.collection.objects.link(o)
    L('key',(2.5,-2.5,4.0),220,(1,0.93,0.88)); L('fill',(-2.2,-1.2,2.2),60,(0.5,0.7,1),2.5)
    L('rim',(0.3,2.2,3.0),110,(0.65,0.85,1),1.6)
    sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=SAMPLES
    sc.cycles.use_denoising=True; sc.render.film_transparent=True
    sc.render.resolution_x=sc.render.resolution_y=res
    sc.view_settings.view_transform='AgX'; sc.view_settings.look='AgX - Medium High Contrast'
    sc.render.image_settings.color_mode='RGBA'

def wind_mat():
    m=bpy.data.materials.new('wind'); m.use_nodes=True
    nt=m.node_tree; n=nt.nodes; l=nt.links
    for x in list(n):
        if x.type!='OUTPUT_MATERIAL': n.remove(x)
    out=n['Material Output']
    p=n.new('ShaderNodeBsdfPrincipled')
    p.inputs['Base Color'].default_value=(0.55,0.82,1.0,1)
    p.inputs['Roughness'].default_value=0.3
    p.inputs['Metallic'].default_value=0.2
    p.inputs['Emission Color'].default_value=(0.6,0.9,1.0,1)
    p.inputs['Emission Strength'].default_value=5.0
    # slight subsurface look via add emission
    em=n.new('ShaderNodeEmission'); em.inputs['Color'].default_value=(0.7,0.95,1.0,1); em.inputs['Strength'].default_value=4.0
    add=n.new('ShaderNodeAddShader'); l.new(p.outputs[0],add.inputs[0]); l.new(em.outputs[0],add.inputs[1]); l.new(add.outputs[0],out.inputs['Surface'])
    return m

def ribbon(pts, bevel=0.04):
    curve=bpy.data.curves.new('r','CURVE'); curve.dimensions='3D'
    curve.bevel_depth=bevel; curve.bevel_resolution=8; curve.fill_mode='FULL'
    # also extrude a bit for flat ribbon face
    curve.extrude = bevel*0.6
    sp=curve.splines.new('NURBS'); sp.points.add(len(pts)-1)
    for i,p in enumerate(pts): sp.points[i].co=(*p,1.0)
    sp.use_endpoint_u=True; sp.order_u=min(4,len(pts))
    o=bpy.data.objects.new('r',curve); sc.collection.objects.link(o); return o

def wrap_pts(phase, turns=2.8, rad=0.22, length=0.85):
    # helix around Y-ish axis tipped so loops face camera (axis along world X slightly tilted)
    pts=[]; n=40
    for i in range(n):
        u=i/(n-1)
        ang = u*turns*2*math.pi + phase
        r = rad*(0.85+0.25*math.sin(u*math.pi))*(1+0.08*math.sin(phase+u*4))
        # axis along X; loops in YZ — with 55° cam looking from -Y, YZ loops face us well
        x = (u-0.5)*length
        y = math.cos(ang)*r
        z = 0.5 + math.sin(ang)*r
        pts.append((x,y,z))
    return pts

def fly_pts(u):
    # big arc in YZ/XY facing camera
    frm=(0.7, 0.15, 0.45); mid=(0.0, -0.35, 1.15); to=(-1.4, 0.2, 0.7)
    def bez(a,b,c,t): return tuple((1-t)*(1-t)*a[i]+2*(1-t)*t*b[i]+t*t*c[i] for i in range(3))
    pts=[]; n=32; trail=0.32
    for i in range(n):
        v=max(0,min(1, u - trail*(1-i/(n-1))))
        p=bez(frm,mid,to,v)
        # corkscrew around path
        tang_approx = 0.15
        cang = i*0.7 + u*8
        pts.append((p[0]+math.cos(cang)*0.06*(1-u*0.3), p[1]+math.sin(cang)*0.06, p[2]+math.sin(cang*1.3)*0.04))
    return pts

def go(path):
    sc.render.filepath=path; bpy.ops.render.render(write_still=True); print('saved',path)

for i in range(8):
    clear(); setup()
    m=wind_mat(); ph=i/7*math.pi*2
    for turns,rad,length,bev,dph in [(2.8,0.24,0.9,0.045,0),(2.2,0.17,0.75,0.028,1.3),(1.7,0.12,0.6,0.018,2.4)]:
        o=ribbon(wrap_pts(ph+dph,turns,rad,length),bev); o.data.materials.append(m)
    ld=bpy.data.lights.new('g','POINT'); ld.energy=55; ld.color=(0.55,0.9,1)
    lo=bpy.data.objects.new('g',ld); lo.location=(0,-0.25,0.5); sc.collection.objects.link(lo)
    go(os.path.join(OUT,'ribbon_wrap_%02d.png'%i))

for i in range(12):
    clear(); setup(ortho_mul=1.55, foot=250)
    m=wind_mat(); u=i/11
    o=ribbon(fly_pts(u), 0.04+0.015*(1-u)); o.data.materials.append(m)
    o2=ribbon([(p[0],p[1]-0.05,p[2]+0.03) for p in fly_pts(max(0,u-0.04))], 0.022); o2.data.materials.append(m)
    tip=fly_pts(u)[-1]
    ld=bpy.data.lights.new('g','POINT'); ld.energy=60; ld.color=(0.55,0.9,1)
    lo=bpy.data.objects.new('g',ld); lo.location=tip; sc.collection.objects.link(lo)
    go(os.path.join(OUT,'ribbon_fly_%02d.png'%i))
print('DONE ribbon2')
