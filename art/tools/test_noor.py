import bpy, sys, math
argv = sys.argv[sys.argv.index('--')+1:]
exec(open('/workspace/games/prompt-injection/art-v6/tools/noor.py').read())
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
ACT = argv[0] if argv else 'idle'; FR = int(argv[1]) if len(argv) > 1 else 10
for k, (rz, a, f) in enumerate(((0, ACT, FR), (45, ACT, FR), (90, ACT, FR), (180, ACT, FR), (90, 'walk', 4), (0, 'walk', 4))):
    root, arm, meshes = build_noor()
    root.location = (k*0.75, 0, 0); root.rotation_euler = (0, 0, math.radians(rz))
    set_action(arm, a, f)
cd = bpy.data.cameras.new('c'); cd.type = 'ORTHO'; cd.ortho_scale = 4.7
cam = bpy.data.objects.new('c', cd); sc.collection.objects.link(cam); sc.camera = cam
t = math.radians(90-38); cam.rotation_euler = (t, 0, 0)
from mathutils import Vector
d = Vector((0, math.sin(t), -math.cos(t))); cam.location = Vector((1.875, 0, 0.4)) - d*10
def L(kind, e, col, rot, size=3):
    l = bpy.data.lights.new(kind, kind); l.energy = e; l.color = col
    if kind == 'SUN': l.angle = math.radians(size)
    o = bpy.data.objects.new(kind, l); o.rotation_euler = [math.radians(a) for a in rot]; sc.collection.objects.link(o); return o
L('SUN', 2.2, (1, 0.86, 0.72), (40, 0, -30))
L('SUN', 5, (0.3, 0.9, 1.0), (-68, 0, 50)); L('SUN', 4, (1.0, 0.22, 0.7), (-68, 0, -50)); L('SUN', 0.8, (0.6, 0.65, 1.0), (50, 0, 0), 15)
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.01, 0.012, 0.03, 1)
sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.cycles.use_denoising = True
sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
sc.render.resolution_x = 2000; sc.render.resolution_y = 480
sc.render.filepath = '/tmp/noor_test.png'; bpy.ops.render.render(write_still=True)
