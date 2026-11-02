# art-v6 P2: Fern phase-state sheets (384 px cells: Fern is ~2x Noor and does not fit the shared 192 cell).
# anims: stagger (6@10), seated (4@4, phase 3, in Kabir's chair). Same camera pitch/scale as every other sprite.
# usage: blender -b --python fern_states.py -- OUTDIR [SAMPLES]
import bpy, sys, math, os, bmesh
from mathutils import Vector
argv = sys.argv[sys.argv.index('--')+1:]; OUT = argv[0]; SAMPLES = int(argv[1]) if len(argv) > 1 else 32
T = '/workspace/games/prompt-injection/art-v6/tools/'; V5 = '/workspace/games/prompt-injection/art-v5/'
FRAME = 384; SS = 2; PX_PER_UNIT = 1280/8.4; ORTHO = FRAME/PX_PER_UNIT; FOOT_Y = 336; R = math.radians
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
exec(open(T+'noor.py').read(), globals()); exec(open(T+'fern.py').read(), globals()); exec(open(T+'enemies.py').read(), globals()); exec(open(T+'rig5.py').read(), globals())
sc = bpy.context.scene
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.010, 0.016, 0.030, 1)
actor_rig(sc)
cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = ORTHO
cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
t = R(90-38); cam.rotation_euler = (t, 0, 0); d = Vector((0, math.sin(t), -math.cos(t))); up = Vector((0, math.cos(t), math.sin(t)))
cam.location = -d*10 + up*((FOOT_Y - FRAME/2)/PX_PER_UNIT)
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
sc.cycles.max_bounces = 4; sc.cycles.transparent_max_bounces = 24; sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = FRAME*SS
sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'; sc.render.image_settings.color_mode = 'RGBA'
S = 1.8
def frags_cone(top):
    fr = [o for o in top.children if o.type == 'MESH' and o.data.materials and o.data.materials[0].name.startswith('frag')]
    cn = [o for o in top.children if o.type == 'MESH' and o.data.materials and o.data.materials[0].name.startswith('fern_cone')]
    return fr, cn
def render(nm):
    sc.render.filepath = os.path.join(OUT, nm); bpy.ops.render.render(write_still=True)
# ---- stagger ----
top = build_fern(0, 0, S, rz=0, action=('crouch', 1)); fr, cn = frags_cone(top)
base = {o: o.location.copy() for o in fr}
arms = [o for o in bpy.data.objects if o.type == 'ARMATURE']
for k in range(6):
    u = [0.3, 1.0, 0.8, 0.6, 0.35, 0.1][k]
    for o in fr: v = base[o]; o.location = Vector((v.x*(1 + 0.45*u), v.y*(1 + 0.45*u), v.z + 0.06*u*math.sin(v.x*9)))
    for o in cn: o.hide_render = k in (1, 3)
    for a in arms: a.location = Vector((0.03*u*(1 if k % 2 else -1), 0, 0)); set_action(a, 'crouch' if u > 0.5 else 'idle', 2 if u > 0.5 else 6)
    render('fern_stagger_S_%02d.png' % k)
# ---- seated (phase 3): in Kabir's chair ----
bpy.ops.wm.read_factory_settings(use_empty=True)
exec(open(T+'noor.py').read(), globals()); exec(open(T+'fern.py').read(), globals()); exec(open(T+'enemies.py').read(), globals()); exec(open(T+'rig5.py').read(), globals())
sc = bpy.context.scene; sc.world = bpy.data.worlds.new('w'); sc.world.use_nodes = True; sc.world.node_tree.nodes['Background'].inputs[0].default_value = (0.010, 0.016, 0.030, 1)
actor_rig(sc); cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = ORTHO
cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam; cam.rotation_euler = (t, 0, 0); cam.location = -d*10 + up*((FOOT_Y - FRAME/2)/PX_PER_UNIT)
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True; sc.cycles.max_bounces = 4; sc.cycles.transparent_max_bounces = 24
sc.render.film_transparent = True; sc.render.resolution_x = sc.render.resolution_y = FRAME*SS
sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'; sc.render.image_settings.color_mode = 'RGBA'
top = build_fern(0, 0, S, rz=0, action=('sit', 2)); fr, cn = frags_cone(top)
for o in cn: o.hide_render = True                       # the cone is off once it sits
base = {o: o.location.copy() for o in fr}
ch = kprop('chair', None, (0, 0.12, 0), rz=180, s=1.35, index=7)
bpy.context.view_layer.update()
seat_z = 0.30*1.35*0.0 + 0.0
for o in [o for o in bpy.data.objects if o.name.endswith('_root') and o.parent == top]: pass
for o in top.children:
    if o.type == 'EMPTY' and o.name.startswith('fern'): o.location.z += 0.20
for k in range(4):
    ph = 2*math.pi*k/4
    for o in fr: v = base[o]; o.location = Vector((v.x*0.75, v.y*0.75, v.z*0.62 + 0.012*math.sin(ph + v.x*5)))
    top.location.z = 0.0; 
    for o in top.children:
        if o.type == 'EMPTY' and o.name.startswith('fern'): o.scale.z = o.scale.x*(1 + 0.006*math.sin(ph))
    render('fern_seated_S_%02d.png' % k)
print('DONE fern')
