# art-v5: render enemy (and Caret ally) sprite frames with the SAME camera + actor rig as Noor's sprites.
# usage: blender -b --python enemy_sprites.py -- NAME[,NAME..] OUTDIR [SAMPLES] [ANIMS]
import bpy, sys, math, os
from mathutils import Vector
argv = sys.argv[sys.argv.index('--')+1:]
NAMES = argv[0].split(','); OUT = argv[1]; SAMPLES = int(argv[2]) if len(argv) > 2 else 16
ONLY = argv[3].split(',') if len(argv) > 3 else None
T = '/workspace/games/prompt-injection/art-v6/tools/'
FRAME = 192; SS = 2; PX_PER_UNIT = 1280/8.4; ORTHO = FRAME/PX_PER_UNIT; FOOT_Y = 160
ROT = dict(S=0, SE=45, E=90, NE=135, N=180, NW=225, W=270, SW=315)
R = math.radians
os.makedirs(OUT, exist_ok=True)
for name in NAMES:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    exec(open(T+'enemies.py').read(), globals()); exec(open(T+'enemies6.py').read(), globals()); exec(open(T+'rig5.py').read(), globals())
    sc = bpy.context.scene
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.010, 0.016, 0.030, 1)
    actor_rig(sc)
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = ORTHO
    cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
    t = R(90-38); cam.rotation_euler = (t, 0, 0); d = Vector((0, math.sin(t), -math.cos(t))); up = Vector((0, math.cos(t), math.sin(t)))
    cam.location = -d*10 + up*((FOOT_Y - FRAME/2)/PX_PER_UNIT)
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 4; sc.cycles.transparent_max_bounces = 16; sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = FRAME*SS
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'; sc.render.image_settings.color_mode = 'RGBA'
    E = BUILD[name]()
    anims = anims_for(name)
    for an, (n, fps) in anims.items():
        if ONLY and an not in ONLY: continue
        for dn in DIRS_FOR[name]:
            E['root'].rotation_euler = (0, 0, R(ROT[dn]))
            for k in range(min(n, int(os.environ.get('NMAX', 99)))):
                pose(E, an, k)
                sc.render.filepath = os.path.join(OUT, '%s_%s_%s_%02d.png' % (name, an, dn, k)); bpy.ops.render.render(write_still=True)
    print('DONE', name)
