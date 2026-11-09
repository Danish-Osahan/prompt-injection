# Flat sash wind ribbon — face-on coils that read at game scale (not emission tubes).
import bpy, sys, math, os, bmesh
from mathutils import Vector
argv = sys.argv[sys.argv.index('--')+1:]
OUT = argv[0]; SAMPLES = int(argv[1]) if len(argv) > 1 else 32
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; R = math.radians
FRAME = 640; PX = 1280/8.4

def wipe():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for d in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.worlds):
        for x in list(d): d.remove(x)

def setup(ortho_mul=1.0, foot=300):
    wipe()
    w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True
    w.node_tree.nodes['Background'].inputs[0].default_value=(0.01,0.015,0.025,1)
    w.node_tree.nodes['Background'].inputs[1].default_value=0.2
    cd=bpy.data.cameras.new('cam'); cd.type='ORTHO'; cd.ortho_scale=(FRAME/PX)*ortho_mul
    cam=bpy.data.objects.new('cam',cd); sc.collection.objects.link(cam); sc.camera=cam
    # nearly frontal
    elev=62; t=R(90-elev); cam.rotation_euler=(t,0,0)
    d=Vector((0,math.sin(t),-math.cos(t))); up=Vector((0,math.cos(t),math.sin(t)))
    cam.location=Vector((0,0,0))-d*16 + up*((foot-FRAME/2)/PX)
    for name,loc,e,col in [('k',(2.0,-3.0,3.5),260,(1,0.95,0.9)),('f',(-2.5,-1.5,2.0),80,(0.55,0.75,1.0)),('r',(0.5,2.5,2.5),140,(0.7,0.9,1.0))]:
        ld=bpy.data.lights.new(name,'AREA'); ld.energy=e; ld.color=col; ld.size=2.2
        o=bpy.data.objects.new(name,ld); o.location=loc; sc.collection.objects.link(o)
    sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=SAMPLES
    sc.cycles.use_denoising=True; sc.render.film_transparent=True
    sc.render.resolution_x=sc.render.resolution_y=FRAME
    sc.view_settings.view_transform='AgX'; sc.view_settings.look='AgX - Medium High Contrast'
    sc.render.image_settings.color_mode='RGBA'

def sash_mat(tint=(0.35,0.72,0.95), emit=2.2):
    m=bpy.data.materials.new('sash'); m.use_nodes=True
    b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=(*tint,1)
    b.inputs['Roughness'].default_value=0.35
    b.inputs['Metallic'].default_value=0.05
    b.inputs['Emission Color'].default_value=(0.55,0.88,1.0,1)
    b.inputs['Emission Strength'].default_value=emit
    try: b.inputs['Alpha'].default_value=0.92
    except: pass
    return m

def ribbon_mesh(pts, width=0.11, name='rib'):
    """Build a flat strip mesh along pts (centerline), facing +Y (toward camera)."""
    bm=bmesh.new()
    # for each point, make a left/right vertex along approx normal in XZ
    left=[]; right=[]
    for i,p in enumerate(pts):
        p=Vector(p)
        if i < len(pts)-1: tang = (Vector(pts[i+1])-p).normalized()
        else: tang = (p-Vector(pts[i-1])).normalized()
        # side = tang × view_approx (view ~ +Y)
        side = tang.cross(Vector((0,1,0)))
        if side.length < 1e-4: side = Vector((1,0,0))
        else: side.normalize()
        # also lift slightly with a binormal for thickness wave
        binorm = side.cross(tang).normalized()
        w = width * (0.85 + 0.25*math.sin(i*0.55))
        left.append(bm.verts.new(p - side*w*0.5 + binorm*0.008*math.sin(i*0.9)))
        right.append(bm.verts.new(p + side*w*0.5 - binorm*0.008*math.sin(i*0.9)))
    bm.verts.ensure_lookup_table()
    for i in range(len(pts)-1):
        bm.faces.new((left[i], right[i], right[i+1], left[i+1]))
    mesh=bpy.data.meshes.new(name); bm.to_mesh(mesh); bm.free()
    o=bpy.data.objects.new(name, mesh); sc.collection.objects.link(o)
    # solidify for thickness
    mod=o.modifiers.new('sol','SOLIDIFY'); mod.thickness=0.022; mod.offset=0
    return o

def wrap_centerline(phase, turns=2.6, rad=0.28, length=1.05):
    pts=[]; n=48
    for i in range(n):
        u=i/(n-1)
        ang=u*turns*2*math.pi + phase
        r=rad*(0.75+0.35*math.sin(u*math.pi))*(1+0.1*math.sin(phase*1.3+u*3))
        # coil around X, in YZ — but push Y forward so faces camera
        x=(u-0.5)*length
        y=math.cos(ang)*r*0.55 - 0.05  # squash depth a bit, bias toward cam
        z=0.55 + math.sin(ang)*r
        pts.append((x,y,z))
    return pts

def fly_centerline(u):
    # big screen-plane arc (mostly X/Z), slight Y for depth
    frm=(0.85, -0.05, 0.5); mid=(-0.05, -0.45, 1.25); to=(-1.55, 0.05, 0.65)
    def bez(a,b,c,t): return tuple((1-t)*(1-t)*a[i]+2*(1-t)*t*b[i]+t*t*c[i] for i in range(3))
    pts=[]; n=40; trail=0.38
    for i in range(n):
        v=max(0.0,min(1.0, u - trail*(1-i/(n-1))))
        p=list(bez(frm,mid,to,v))
        # corkscrew offset in screen-ish plane
        a=i*0.65 + u*9
        p[0]+=math.cos(a)*0.09*(1-0.35*u)
        p[2]+=math.sin(a)*0.09*(1-0.35*u)
        p[1]+=math.sin(a*0.7)*0.03
        pts.append(tuple(p))
    return pts

def render(path):
    sc.render.filepath=path; bpy.ops.render.render(write_still=True); print('saved', path)

for i in range(8):
    setup(); m=sash_mat(); ph=i/7*2*math.pi
    # three layered sashes
    for turns,rad,length,w,dph,tint,em in [
        (2.7,0.30,1.1,0.13,0.0,(0.30,0.70,0.95),2.5),
        (2.1,0.22,0.9,0.09,1.4,(0.45,0.82,1.0),3.0),
        (1.6,0.16,0.7,0.06,2.5,(0.70,0.92,1.0),3.5),
    ]:
        o=ribbon_mesh(wrap_centerline(ph+dph,turns,rad,length), width=w)
        o.data.materials.append(sash_mat(tint,em))
    ld=bpy.data.lights.new('g','POINT'); ld.energy=70; ld.color=(0.5,0.85,1)
    lo=bpy.data.objects.new('g',ld); lo.location=(0,-0.4,0.55); sc.collection.objects.link(lo)
    render(os.path.join(OUT,'ribbon_wrap_%02d.png'%i))

for i in range(12):
    setup(ortho_mul=1.65, foot=290); u=i/11
    o=ribbon_mesh(fly_centerline(u), width=0.12+0.04*(1-u))
    o.data.materials.append(sash_mat((0.35,0.78,1.0), 3.0))
    o2=ribbon_mesh([(p[0],p[1]-0.04,p[2]+0.03) for p in fly_centerline(max(0,u-0.05))], width=0.07)
    o2.data.materials.append(sash_mat((0.55,0.88,1.0), 3.5))
    tip=fly_centerline(u)[-1]
    ld=bpy.data.lights.new('g','POINT'); ld.energy=80; ld.color=(0.55,0.9,1)
    lo=bpy.data.objects.new('g',ld); lo.location=tip; sc.collection.objects.link(lo)
    render(os.path.join(OUT,'ribbon_fly_%02d.png'%i))
print('DONE ribbon3')
