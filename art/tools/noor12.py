# art-v6 (calm attack FX: teal keys, amber/ice shards, warm bolt, soft ice ring). was art-v5: render Noor's sprite frames (8 directions) at the game's 3/4 camera (ortho, 38 deg elevation, same px/unit as the
# 1280x720 mocks: ortho 8.4 / 1280 px), neon-noir rig fixed to the camera. Frames are rendered at 2x and downsampled in pack.py.
# art-v12 noor12.py: NEW attack set (combo1-3, peel, throw, charge_in, charge_hold, release) on the SAME 38 deg rig/camera/lights as noor7 (art-v7/v8 sheets the game uses).
# No props (the caret blade / keys / shards are gone). Smear frames = accumulated sub-frame renders. Writes frames + meta12.json (hand px, events).
# usage: blender -b --python noor12.py -- ANIMS|all OUTDIR [SAMPLES] [DIRS]
# was art-v7: Noor dash + 3-hit TYPE combo. usage: blender -b --python noor7.py -- ANIMS(dash,type1,type2,type3) OUTDIR [SAMPLES] [DIRS]
import bpy, sys, math, os
from mathutils import Vector, Quaternion
argv = sys.argv[sys.argv.index('--')+1:]
ANIMS = argv[0].split(','); OUT = argv[1]; SAMPLES = int(argv[2]) if len(argv) > 2 else 24
DIRS = argv[3].split(',') if len(argv) > 3 else ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW']
T = os.path.dirname(os.path.abspath(sys.argv[sys.argv.index('--python')+1])) + '/'
bpy.ops.wm.read_factory_settings(use_empty=True)
exec(open(T+'noor.py').read())
sc = bpy.context.scene; R = math.radians
os.makedirs(OUT, exist_ok=True)
FRAME = 192; SS = 2; PX_PER_UNIT = 1280/8.4; ORTHO = FRAME/PX_PER_UNIT; FOOT_Y = 160   # foot pivot (px from top, at 1x)
ROT = dict(S=0, SE=45, E=90, NE=135, N=180, NW=225, W=270, SW=315)

def rig():
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.010, 0.016, 0.030, 1)
    exec(open(T+'rig5.py').read(), globals()); actor_rig(sc)
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = ORTHO
    cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
    t = R(90-38); cam.rotation_euler = (t, 0, 0)
    d = Vector((0, math.sin(t), -math.cos(t)))
    # put the world origin (feet) at pixel (96, FOOT_Y): shift the camera along its up vector
    up = Vector((0, math.cos(t), math.sin(t)))
    off = (FOOT_Y - FRAME/2)/PX_PER_UNIT
    cam.location = Vector((0, 0, 0)) - d*10 + up*off
    # shadow catcher
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 4; sc.cycles.transparent_max_bounces = 16
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = FRAME*SS
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
    sc.render.image_settings.color_mode = 'RGBA'

# ---------- pose utilities (sample CC0 Kenney actions, blend, add typing offsets) ----------
def pose_of(arm, key, frame):
    act = bpy.data.actions[arm['actions'][key]]; P = {}
    for pb in arm.pose.bones:
        base = 'pose.bones["%s"].' % pb.name
        def ev(prop, n, default):
            out = []
            for i in range(n):
                fc = act.fcurves.find(base+prop, index=i); out.append(fc.evaluate(frame) if fc else default[i])
            return out
        P[pb.name] = (Vector(ev('location', 3, (0, 0, 0))), Quaternion(ev('rotation_quaternion', 4, (1, 0, 0, 0))), Vector(ev('scale', 3, (1, 1, 1))))
    return P
def blend(A, B, t):
    return {k: (A[k][0].lerp(B[k][0], t), A[k][1].slerp(B[k][1], t), A[k][2].lerp(B[k][2], t)) for k in A}
def apply(arm, P, extra=None):
    if arm.animation_data: arm.animation_data.action = None
    for pb in arm.pose.bones:
        l, q, s = P[pb.name]; pb.rotation_mode = 'QUATERNION'
        if extra and pb.name in extra: q = q @ extra[pb.name]
        pb.location = l; pb.rotation_quaternion = q; pb.scale = s
    bpy.context.view_layer.update()
def qx(deg): return Quaternion((1, 0, 0), R(deg))
def qz(deg): return Quaternion((0, 0, 1), R(deg))


import json
from mathutils import Matrix
def qy(deg): return Quaternion((0, 1, 0), R(deg))
def A(x=0, z=0, y=0):  # arm rotation: raise about bone X, splay about bone Z, then swing horizontally about the (vertical) bone Y
    return qy(y) @ qz(z) @ qx(x)

# ---------- frame specs ----------
# c crouch blend, lean (torso fwd +), tw torso twist (+ = towards her left), ar/al arm quats, yaw root spin deg, dz root drop,
# glow hand emission 0..2, pinch finger gap 0..1 (None hides the fingers), sm smear (sub-frame accumulation from previous frame),
# step root motion px (1x sheet px, along facing, applied game-side), ev event name
def D(f, o, u): return (f, o, u)   # arm direction in her torso frame: forward, outward (+ = away from the body, - = across it), up
def F(**k):
    d = dict(wide=0, sr=1.0, sl=1.0, blow=(0, 0), c=0, lean=0, tw=0, ar=None, al=None, yaw=0, dz=0, glow=0, pinch=None, sm=False, step=0, ev=None, hd=0)
    d.update(k); return d
REST = dict(ar=A(), al=A())
PLAN = {
 # HIT 1 quick jab: antic 0-1, smear 2, hit 3, hold 4, recovery 5-6
 'combo1': [F(c=.2, lean=-4, tw=14, ar=D(-.5, .4, -1)), F(c=.35, lean=-8, tw=24, ar=D(-.8, .3, -.6), al=D(.4, .3, -1), dz=-.01),
            F(c=.3, lean=6, tw=0, ar=D(.8, .2, -.3), al=D(-.2, .4, -1), sm=True, step=3), F(c=.3, lean=12, tw=-18, ar=D(1, -.05, .1), al=D(-.5, .3, -.8), dz=-.01, step=6, ev='hit'),
            F(c=.3, lean=11, tw=-16, ar=D(1, -.02, .05), al=D(-.5, .3, -.8), dz=-.01, step=6), F(c=.2, lean=4, tw=-6, ar=D(.6, .2, -.6), al=D(-.2, .4, -1), step=6),
            F(c=.05, lean=0, tw=0, ar=D(.15, .35, -1), step=6)],
 # HIT 2 cross-body swipe (right arm, out wide -> across to her left): antic 0-1, smear 2-3, hit 4, hold 5, recovery 6-7
 'combo2': [F(c=.2, lean=-2, tw=24, ar=D(0, .9, -.6)), F(c=.35, lean=-4, tw=40, ar=D(-.3, 1, .05), al=D(.5, -.2, -.8), dz=-.01),
            F(c=.35, lean=6, tw=18, ar=D(.9, .7, 0), al=D(.2, .3, -1), sm=True, step=2), F(c=.35, lean=10, tw=-20, ar=D(1, -.1, 0), al=D(-.3, .5, -.9), sm=True, step=5),
            F(c=.35, lean=12, tw=-48, ar=D(.6, -.9, -.05), al=D(-.6, .5, -.6), dz=-.015, step=7, ev='hit'), F(c=.35, lean=11, tw=-50, ar=D(.55, -.9, -.1), al=D(-.6, .5, -.6), dz=-.015, step=7),
            F(c=.2, lean=4, tw=-24, ar=D(.5, -.3, -.7), al=D(-.3, .4, -1), step=7), F(c=.05, lean=0, tw=-6, ar=D(.15, .2, -1), step=7)],
 # HIT 3 spinning finisher: antic 0-1 (coil), smear spin 2-4, hit 5 (back-fist out of the spin), hold 6, recovery 7-10
 'combo3': [F(c=.4, lean=-4, tw=30, ar=D(.3, -.6, -.6), al=D(.4, -.5, -.7), dz=-.02), F(c=.6, lean=-8, tw=38, ar=D(.4, -.8, -.4), al=D(.5, -.7, -.5), yaw=-25, dz=-.035),
            F(c=.4, lean=4, tw=10, ar=D(.1, 1, .05), al=D(.1, 1, .05), yaw=80, dz=-.02, sm=True, step=2), F(c=.4, lean=6, tw=0, ar=D(0, 1, .1), al=D(0, 1, .1), yaw=190, dz=-.02, sm=True, step=4),
            F(c=.45, lean=8, tw=-10, ar=D(.4, 1, 0), al=D(-.1, 1, 0), yaw=295, dz=-.025, sm=True, step=7),
            F(c=.55, lean=14, tw=-30, ar=D(1, -.25, .05), al=D(-.6, .6, -.5), yaw=360, dz=-.04, step=10, ev='hit'), F(c=.55, lean=13, tw=-30, ar=D(1, -.22, 0), al=D(-.6, .6, -.5), yaw=360, dz=-.04, step=10),
            F(c=.4, lean=8, tw=-18, ar=D(.7, 0, -.5), al=D(-.3, .5, -.8), yaw=360, dz=-.03, step=10), F(c=.25, lean=2, tw=-6, ar=D(.3, .3, -.9), yaw=360, dz=-.015, step=10),
            F(c=.1, lean=-1, tw=0, ar=D(.1, .35, -1), yaw=360, step=10), F(yaw=360, step=10)],
 # reach-and-peel: reach 0-3, pinch 4, tug 5, peel (pull back) 6-7, settle 8-9
 'peel': [F(lean=4, hd=6, ar=D(.2, .4, -1)), F(c=.15, lean=-2, ar=D(-.3, .4, -.9), pinch=1), F(c=.2, lean=12, ar=D(.9, .2, -.2), pinch=1, step=4),
          F(c=.25, lean=16, ar=D(1, .1, .05), pinch=1, step=6, hd=6), F(c=.25, lean=16, ar=D(1, .1, .05), pinch=0, step=6, hd=6, ev='pinch'),
          F(c=.25, lean=8, ar=D(1, .1, 0), pinch=0, step=6), F(c=.3, lean=-10, ar=D(.5, .2, -.1), pinch=0, step=4, ev='peel'),
          F(c=.2, lean=-8, ar=D(.6, -.3, .1), pinch=0, step=3), F(c=.05, lean=-2, ar=D(.6, -.3, -.2), pinch=0, step=3), F(lean=0, ar=D(.5, -.2, -.4), pinch=0, step=3)],
 # word throw: antic 0-2 (wind over the shoulder), smear 3, release 4 (wrist flick), follow-through 5-6, recovery 7-9
 'throw': [F(c=.15, tw=20, ar=D(-.5, .5, -.4), al=D(.4, .3, -.9)), F(c=.3, lean=-10, tw=34, ar=D(-.4, .3, .9), al=D(.8, .1, -.2), dz=-.01),
           F(c=.35, lean=-14, tw=40, ar=D(-.8, .2, .7), al=D(.9, 0, 0), dz=-.015), F(c=.35, lean=4, tw=10, ar=D(.3, .2, 1), al=D(.5, .2, -.5), sm=True, step=4),
           F(c=.35, lean=14, tw=-12, ar=D(1, .05, .25), al=D(-.3, .4, -.8), dz=-.02, step=8, ev='release'), F(c=.4, lean=18, tw=-30, ar=D(.7, -.6, -.4), al=D(-.5, .4, -.7), dz=-.025, step=9),
           F(c=.4, lean=17, tw=-32, ar=D(.6, -.7, -.5), al=D(-.5, .4, -.7), dz=-.025, step=9), F(c=.25, lean=8, tw=-16, ar=D(.4, -.2, -.8), step=9),
           F(c=.1, lean=2, tw=-4, ar=D(.15, .3, -1), step=9), F(step=9)],
 # beam: charge_in 0-3, charge_hold 0-5 (loops), release: brace 0, RELEASE 1, recoil 2-3, recover 4-6
 'charge_in': [F(c=.15, lean=-3, tw=-8, ar=D(.6, .25, -.5), al=D(.5, .1, -.7), glow=.15, wide=6),
               F(c=.3, lean=-5, tw=-14, ar=D(.75, .2, -.35), sr=1.08, al=D(.8, -.35, -.4), glow=.3, wide=10, dz=-.01),
               F(c=.42, lean=-6, tw=-18, ar=D(.8, .15, -.3), sr=1.12, al=D(.85, -.45, -.35), sl=1.08, glow=.5, wide=13, dz=-.02, blow=(0, -4)),
               F(c=.48, lean=-6, tw=-20, ar=D(.82, .14, -.28), sr=1.14, al=D(.86, -.47, -.33), sl=1.08, glow=.6, wide=14, dz=-.025, blow=(0, -6))],
 'charge_hold': [F(c=.48 + .015*math.sin(i/6*2*math.pi), lean=-6 - 1.0*math.sin(i/6*2*math.pi), tw=-20, ar=D(.82, .14, -.28 + .02*math.sin(i/6*2*math.pi)), sr=1.14,
                   al=D(.86, -.47, -.33), sl=1.08, glow=.6 + .08*math.sin(i/6*2*math.pi), wide=14, dz=-.025, blow=(2*math.sin(i/6*2*math.pi), -7 - 3*math.sin(i/6*2*math.pi))) for i in range(6)],
 # beam v2: brace (anticipation) 0, SNAP release 1, kick 2, hold 3-4, fade 5-6, recovery 7-8. No smears.
 'release': [F(c=.55, lean=-9, tw=-22, ar=D(.55, .25, -.45), sr=1.1, al=D(.75, -.4, -.45), sl=1.08, wide=15, dz=-.03, glow=.8, blow=(0, -8)),
             F(c=.5, lean=10, tw=-28, ar=D(1, .06, .04), sr=1.35, al=D(1, -.5, 0), sl=1.15, wide=17, dz=-.03, glow=1.4, blow=(0, -28), step=3, ev='release'),
             F(c=.5, lean=-8, tw=-28, ar=D(.95, .06, .18), sr=1.32, al=D(.95, -.5, .1), sl=1.15, wide=17, dz=-.03, glow=1.1, blow=(0, -32), step=-3),
             F(c=.5, lean=-4, tw=-27, ar=D(1, .06, .1), sr=1.33, al=D(1, -.5, .05), sl=1.15, wide=17, dz=-.03, glow=1.0, blow=(0, -26), step=-4),
             F(c=.5, lean=-3, tw=-27, ar=D(1, .06, .08), sr=1.33, al=D(1, -.5, .03), sl=1.15, wide=17, dz=-.03, glow=.9, blow=(0, -22), step=-5),
             F(c=.45, lean=-2, tw=-24, ar=D(.9, .1, 0), sr=1.25, al=D(.85, -.4, -.1), sl=1.1, wide=15, dz=-.025, glow=.5, blow=(0, -12), step=-5),
             F(c=.35, lean=-1, tw=-16, ar=D(.7, .2, -.3), sr=1.12, al=D(.5, -.1, -.6), sl=1.04, wide=11, dz=-.02, glow=.2, blow=(0, -4), step=-5),
             F(c=.2, lean=0, tw=-6, ar=D(.4, .3, -.7), wide=6, dz=-.01, step=-5),
             F(step=-5)],
 # STEAL QUALITIES (v2 beat): exaggerated for ~50px game scale — brace+claw pull, full-arm hurl
 # pull: plant 0-1, reach+claw both hands 2-3, brace lean-back 4-5 (RIP), recoil hold 6-7, settle 8-9
 'pull': [F(c=.2, lean=6, hd=4, ar=D(.4, .5, -.6), al=D(.4, -.5, -.6)),
          F(c=.35, lean=10, hd=8, ar=D(.7, .4, -.2), al=D(.7, -.4, -.2), pinch=1, step=2),
          F(c=.45, lean=16, hd=10, ar=D(1.0, .25, .05), al=D(1.0, -.25, .05), pinch=1, step=4),
          F(c=.55, lean=18, hd=12, ar=D(1.05, .15, .1), al=D(1.05, -.15, .1), pinch=1, step=5, ev='claw'),
          F(c=.6, lean=-14, hd=8, ar=D(.55, .35, -.15), al=D(.55, -.35, -.15), pinch=0, dz=-.02, step=3, ev='rip'),
          F(c=.65, lean=-22, hd=6, ar=D(.35, .4, -.35), al=D(.35, -.4, -.35), pinch=0, dz=-.03, step=2),
          F(c=.55, lean=-18, tw=-8, ar=D(.45, .3, -.25), al=D(.2, -.5, -.5), pinch=0, dz=-.02),
          F(c=.4, lean=-10, tw=-4, ar=D(.5, .2, -.4), al=D(.15, -.4, -.7), pinch=0, dz=-.01),
          F(c=.2, lean=-2, ar=D(.4, .25, -.7), al=D(.2, -.3, -.8)),
          F(lean=0, ar=D(.3, .3, -.9), al=D(.25, -.25, -.9))],
 # pull_side: THREE-QUARTER readable — plant facing cam, both arms claw to her LEFT (window), brace lean, rip
 # render with DIRS=S,SE and STEAL CHEAT so torso faces camera enough to show arms
 'pull_side': [F(c=.3, lean=2, tw=22, hd=8, ar=D(.5, .7, -.15), al=D(1.0, .15, .35), wide=10),
          F(c=.45, lean=6, tw=26, hd=12, ar=D(.65, .55, .1), al=D(1.15, .2, .5), pinch=1, wide=12, step=2),
          F(c=.55, lean=10, tw=30, hd=14, ar=D(.75, .4, .25), al=D(1.25, .25, .55), pinch=1, wide=14, step=3),
          F(c=.6, lean=12, tw=32, hd=16, ar=D(.85, .3, .35), al=D(1.3, .3, .6), pinch=1, wide=14, step=4, ev='claw'),
          F(c=.65, lean=-18, tw=8, hd=10, ar=D(.35, .55, .05), al=D(.5, -.7, .2), pinch=0, dz=-.02, wide=16, step=2, ev='rip'),
          F(c=.7, lean=-28, tw=0, hd=8, ar=D(.25, .6, -.15), al=D(.35, -.85, .05), pinch=0, dz=-.035, wide=16),
          F(c=.55, lean=-20, tw=-6, ar=D(.4, .45, -.2), al=D(.4, -.6, -.15), pinch=0, dz=-.02, wide=12),
          F(c=.4, lean=-10, tw=-4, ar=D(.45, .35, -.4), al=D(.4, -.45, -.35), pinch=0, dz=-.01, wide=8),
          F(c=.25, lean=-2, tw=0, ar=D(.4, .3, -.65), al=D(.35, -.35, -.55), wide=4),
          F(lean=0, tw=0, ar=D(.3, .3, -.9), al=D(.25, -.25, -.9))],
 # hurl: antic coil 0-2, smear 3, SNAP release 4, deep follow-through 5-7, recover 8-9
 'hurl': [F(c=.25, lean=-8, tw=28, ar=D(-.6, .55, -.2), al=D(.5, .3, -.8), dz=-.01),
          F(c=.4, lean=-14, tw=42, ar=D(-.7, .35, .85), al=D(.85, .05, -.15), dz=-.02),
          F(c=.5, lean=-18, tw=48, ar=D(-.95, .2, .75), al=D(1.0, -.1, .05), dz=-.025),
          F(c=.45, lean=2, tw=12, ar=D(.2, .25, 1.05), al=D(.55, .15, -.4), sm=True, step=5),
          F(c=.5, lean=18, tw=-18, ar=D(1.1, .0, .35), al=D(-.4, .45, -.7), dz=-.03, step=10, ev='release'),
          F(c=.55, lean=22, tw=-36, ar=D(.85, -.75, -.35), al=D(-.55, .4, -.6), dz=-.035, step=12),
          F(c=.5, lean=20, tw=-40, ar=D(.7, -.85, -.45), al=D(-.55, .4, -.6), dz=-.03, step=12),
          F(c=.35, lean=10, tw=-20, ar=D(.45, -.35, -.7), al=D(-.2, .35, -.8), step=10),
          F(c=.15, lean=2, tw=-6, ar=D(.2, .25, -.95), step=8),
          F(step=6)],

}
LOOPS = {'charge_hold'}
BEAM = {'charge_in', 'charge_hold', 'release'}
STEAL = {'pull', 'pull_side', 'hurl'}
CHEAT = json.loads(os.environ.get('CHEAT', '{"S": 40, "N": 35, "SE": 15, "SW": 15}'))  # steal/beam: show the arms
# follow-through: hair + coat hem run on a damped spring driven by how fast the torso turns / pitches, and keep moving after she stops
# (each anim gets 3 extra 'settle' frames appended at runtime only if the last frame still has motion -> instead we bake the settle into the last frames)
def secondary(plan, loop=False):
    out = []; a = Vector((0, 0)); v = Vector((0, 0)); prev = None
    seq = plan*3 if loop else plan  # loops: run 3 cycles, keep the last (steady state)
    for f in seq:
        ang = Vector((f['tw'] + f['yaw'], f['lean']))
        d = (ang - prev) if prev is not None else Vector((0, 0)); prev = ang
        tgt = Vector((-d.x*0.55, -d.y*0.9))
        v = v*0.5 + (tgt - a)*0.42; a = a + v
        a.x = max(-70, min(70, a.x)); a.y = max(-55, min(55, a.y))
        out.append(a.copy())
    return out[-len(plan):]

# ---------- build ----------
rig()
root, arm, meshes = build_noor()
idle = pose_of(arm, 'idle', 0); cr = pose_of(arm, 'crouch', 8)
bpy.context.view_layer.update()
hd = [o for o in bpy.data.objects if o.parent == arm and o.parent_type == 'BONE' and o.parent_bone == 'head']
lumps = [o for o in hd if o.type == 'MESH' and o.name.startswith('Ico')]
bc = sum((o.matrix_world.translation for o in lumps), Vector())/max(1, len(lumps))
strands = [o for o in hd if o.type == 'CURVE']
fly = [o for o in strands if (o.matrix_world @ o.data.splines[0].bezier_points[0].co).z > 0.6]
locks = [o for o in strands if o not in fly]
pencil = [o for o in bpy.data.objects if o.name.startswith('pencil') and o.type == 'EMPTY']
def pivot(name, at, kids):
    pv = bpy.data.objects.new(name, None); sc.collection.objects.link(pv)
    bpy.context.view_layer.update(); pv.parent = arm; pv.parent_type = 'BONE'; pv.parent_bone = 'head'; pv.matrix_world = Matrix.Translation(at)
    bpy.context.view_layer.update(); pv['rest'] = [list(r) for r in pv.matrix_basis]
    for o in kids: mw = o.matrix_world.copy(); o.parent = pv; o.parent_type = 'OBJECT'; o.matrix_world = mw
    return pv
BUN = pivot('bun_pivot', bc - Vector((0, 0, 0.04)), lumps + fly + pencil)
LOCKS = [pivot('lock_pivot', (o.matrix_world @ o.data.splines[0].bezier_points[0].co), [o]) for o in locks]

# coat hem hook (follow-through on the skinned cardigan): weight the lower hem, hook it to an empty under the root
card = bpy.data.objects['noor_cardigan']
vg = card.vertex_groups.new(name='hem')
for v in card.data.vertices:
    z = (card.matrix_world @ v.co).z; w = max(0.0, min(1.0, (0.235 - z)/0.07))
    if w > 0: vg.add([v.index], w, 'REPLACE')
HOOK = bpy.data.objects.new('hem_hook', None); sc.collection.objects.link(HOOK); HOOK.parent = root; HOOK.location = (0, 0.03, 0.2)
bpy.context.view_layer.update()
hm = card.modifiers.new('hem', 'HOOK'); hm.object = HOOK; hm.vertex_group = 'hem'
hm.matrix_inverse = HOOK.matrix_world.inverted(); hm.center = HOOK.matrix_world.translation

# hands: the farthest arm vertex from the shoulder at rest -> an empty on the arm bone
body = [o for o in arm.children if o.type == 'MESH' and 'body' in o.name][0]
def hand_empty(side):
    g = body.vertex_groups['arm-' + side].index; best = None
    sh = arm.matrix_world @ arm.data.bones['arm-' + side].head_local
    for v in body.data.vertices:
        if any(x.group == g and x.weight > .9 for x in v.groups):
            p = body.matrix_world @ v.co
            if best is None or (p - sh).length > (best - sh).length: best = p
    e = bpy.data.objects.new('hand_' + side, None); sc.collection.objects.link(e)
    e.parent = arm; e.parent_type = 'BONE'; e.parent_bone = 'arm-' + side; bpy.context.view_layer.update(); e.matrix_world = Matrix.Translation(best)
    return e
HR = hand_empty('right'); HL = hand_empty('left')
# glow: an emissive core + soft shell + point light on the right paw (beam charge)
def emat(name, rgb):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL': nt.nodes.remove(n)
    e = nt.nodes.new('ShaderNodeEmission'); e.inputs[0].default_value = (*lin(rgb), 1)
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(e.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], nt.nodes['Material Output'].inputs[0])
    return m, e, mx
GM, GE, GX = emat('glowcore', (210, 250, 255)); SM_, SE_, SX = emat('glowshell', (120, 228, 232))
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.035, segments=16, ring_count=8); core = bpy.context.object; core.data.materials.append(GM)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.07, segments=16, ring_count=8); shell = bpy.context.object; shell.data.materials.append(SM_)
for o in (core, shell): o.parent = HR; o.location = (0, 0, 0)
for o in (core, shell): o.visible_shadow = False
ld = bpy.data.lights.new('glowL', 'POINT'); ld.color = (0.55, 0.92, 0.95); ld.shadow_soft_size = 0.05
GL = bpy.data.objects.new('glowL', ld); sc.collection.objects.link(GL); GL.parent = HR
# pinch: two small skin finger nubs at the right paw that open / close
skin = _mat('pinchskin', NOOR['skin'], rough=0.6)
FING = []
for s in (-1, 1):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.016, segments=10, ring_count=6); o = bpy.context.object; o.data.materials.append(skin); o.parent = HR; FING.append((o, s))

# arm direction -> bone rotation (pose-space): rotate the rest shoulder->paw vector onto the wanted direction
arm.data.pose_position = 'REST'; bpy.context.view_layer.update()
V0 = {}
for side, H in (('right', HR), ('left', HL)):
    b = arm.data.bones['arm-' + side]; sh = arm.matrix_world @ b.head_local
    V0[side] = (arm.matrix_world.inverted().to_3x3() @ (H.matrix_world.translation - sh)).normalized()
arm.data.pose_position = 'POSE'; bpy.context.view_layer.update()
QIDLE = {s_: idle['arm-' + s_][1] for s_ in ('right', 'left')}
def arm_q(side, d):
    if d is None: return QIDLE[side]
    f, o, u = d; sx = -1 if side == 'right' else 1
    t = Vector((sx*o, -f, u)).normalized()   # armature space: she faces -Y, her right is -X
    Rw = V0[side].rotation_difference(t)
    B = arm.data.bones['arm-' + side].matrix_local.to_3x3().to_quaternion()
    return B.inverted() @ Rw @ B
def set_glow(g):
    on = g > 0.01
    for o in (core, shell, GL): o.hide_render = not on
    GE.inputs[1].default_value = 6*g; GX.inputs[0].default_value = min(1, .4 + g)
    SE_.inputs[1].default_value = 2.5*g; SX.inputs[0].default_value = min(.55, .35*g)
    ld.energy = 1.2*g
def set_pinch(p):
    for o, s in FING:
        o.hide_render = p is None
        if p is not None: o.location = (s*0.012*(0.4 + 1.4*p), 0, -0.012)

def hair_set(ang):   # ang = (sideways deg about her forward axis, pitch deg about her right axis)
    bpy.context.view_layer.update()
    for pv in [BUN] + LOCKS: pv.matrix_basis = Matrix([r for r in pv['rest']])
    bpy.context.view_layer.update()
    M = root.matrix_world.to_3x3(); right = (M @ Vector((1, 0, 0))).normalized(); fwd = (M @ Vector((0, -1, 0))).normalized()
    for pv, f in [(BUN, 1.0)] + [(l, 0.75) for l in LOCKS]:
        mw = pv.matrix_world.copy(); p0 = mw.translation.copy()
        rot = Matrix.Rotation(R(ang[1]*f), 4, right) @ Matrix.Rotation(R(ang[0]*f), 4, fwd)
        pv.matrix_world = Matrix.Translation(p0) @ rot @ Matrix.Translation(-p0) @ mw
    bpy.context.view_layer.update()
def coat_set(ang):   # hem lags the torso: twist about the vertical + swing opposite to the pitch
    HOOK.rotation_euler = (R(-ang[1]*0.35), 0, R(ang[0]*0.45)); HOOK.location = (0, 0.03 + ang[1]*0.0009, 0.2)

WSIGN = float(os.environ.get('WSIGN', '1'))
def pose_frame(f, yaw0, sec):
    P = dict(blend(idle, cr, f['c']))
    for side, k in (('right', 'qr'), ('left', 'ql')):
        l, q, s_ = P['arm-' + side]; sc_ = f['s' + side[0]]
        P['arm-' + side] = (l, f[k] if k in f else arm_q(side, f['a' + side[0]]), s_*sc_ if sc_ != 1.0 else s_)
    ex = {'torso': qz(f['tw']) @ qx(f['lean']), 'head': qx(f['hd'])}
    if f['wide']:   # braced stance: splay the legs (beam v2)
        ex['leg-left'] = qz(f['wide']*WSIGN); ex['leg-right'] = qz(-f['wide']*WSIGN)
    apply(arm, P, ex)
    root.rotation_euler = (0, 0, yaw0 + R(f['yaw'])); root.location = (0, 0, f['dz'])
    sec = Vector(sec) + Vector(f['blow'])
    coat_set(sec); hair_set(sec); set_glow(f['glow']); set_pinch(f['pinch'])
def mix(a, b, t):
    o = dict(b)
    for k in ('c', 'lean', 'tw', 'yaw', 'dz', 'glow', 'hd'): o[k] = a[k] + (b[k] - a[k])*t
    for k, side in (('qr', 'right'), ('ql', 'left')):
        qa = a.get(k, arm_q(side, a['a' + side[0]])); qb = b.get(k, arm_q(side, b['a' + side[0]])); o[k] = qa.slerp(qb, t)
    return o

def render(path):
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)
def project(obj):
    from bpy_extras.object_utils import world_to_camera_view
    c = world_to_camera_view(sc, sc.camera, obj.matrix_world.translation)
    return [round(c.x*FRAME, 1), round((1 - c.y)*FRAME, 1)]

import numpy as np
NSUB = int(os.environ.get('NSUB', '7'))
want = list(PLAN) if ANIMS == ['all'] else ANIMS
mp = os.path.join(OUT, 'meta12.json'); META = json.load(open(mp)) if os.path.exists(mp) else {}
for an in want:
    plan = PLAN[an]; sec = secondary(plan, an in LOOPS)
    META[an] = {'frames': len(plan), 'events': {str(k): f['ev'] for k, f in enumerate(plan) if f['ev']}, 'smear': [k for k, f in enumerate(plan) if f['sm']],
                'step_px': [f['step'] for f in plan], 'loop': an in LOOPS, 'hand': {}}
    for dn in DIRS:
        yaw0 = R(ROT[dn] + (CHEAT.get(dn, 0) if an in (BEAM | STEAL) else 0)); hands = []
        for k, f in enumerate(plan[:int(os.environ.get('NMAX', 99))]):
            path = os.path.join(OUT, '%s_%s_%02d.png' % (an, dn, k))
            if f['sm'] and k > 0:
                # smear: accumulate sub-frames from the previous pose to this one (later sub-frames weigh more, so the lead pose stays solid)
                acc = None; wsum = 0; amax = None
                for i in range(NSUB):
                    t = (i + 1)/NSUB; g = mix(plan[k-1], f, t); s2 = sec[k-1].lerp(sec[k], t)
                    pose_frame(g, yaw0, s2); render('/tmp/_sub.png')
                    im = bpy.data.images.load('/tmp/_sub.png'); px = np.array(im.pixels[:], np.float32).reshape(FRAME*SS, FRAME*SS, 4); bpy.data.images.remove(im)
                    w = 0.35 + t
                    pm = px.copy(); pm[..., :3] *= pm[..., 3:4]
                    acc = pm*w if acc is None else acc + pm*w; wsum += w; amax = px[..., 3] if amax is None else np.maximum(amax, px[..., 3])
                # trail = weighted mean of the sub-frames (premultiplied), lifted toward warm white; the final pose sits SOLID on top
                acc /= wsum; ta = np.clip(acc[..., 3]*1.25, 0, 0.85)
                trgb = acc[..., :3]/np.maximum(acc[..., 3:4], 1e-4); trgb = trgb*0.6 + np.array([1.0, 0.95, 0.86])*0.4
                fa = px[..., 3:4]; o_a = fa[..., 0] + ta*(1 - fa[..., 0])
                o_rgb = (px[..., :3]*fa + trgb*ta[..., None]*(1 - fa))/np.maximum(o_a[..., None], 1e-4)
                o = np.dstack([o_rgb, o_a]).astype(np.float32)
                img = bpy.data.images.new('sm', FRAME*SS, FRAME*SS, alpha=True); img.pixels = o.ravel().tolist()
                img.filepath_raw = path; img.file_format = 'PNG'; img.save(); bpy.data.images.remove(img)
            else:
                pose_frame(f, yaw0, sec[k]); render(path)
            hands.append(project(HR))
        META[an]['hand'][dn] = hands
    json.dump(META, open(mp, 'w'), indent=1)
print('DONE noor12')
