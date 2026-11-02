# art-v6 (calm attack FX: teal keys, amber/ice shards, warm bolt, soft ice ring). was art-v5: render Noor's sprite frames (8 directions) at the game's 3/4 camera (ortho, 38 deg elevation, same px/unit as the
# 1280x720 mocks: ortho 8.4 / 1280 px), neon-noir rig fixed to the camera. Frames are rendered at 2x and downsampled in pack.py.
# art-v7: Noor dash + 3-hit TYPE combo. usage: blender -b --python noor7.py -- ANIMS(dash,type1,type2,type3) OUTDIR [SAMPLES] [DIRS]
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


# ---------- the Caret blade: a teal text-cursor bar held in the right hand ----------
def caret_blade(arm):
    m = bpy.data.materials.new('caretblade'); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL': nt.nodes.remove(n)
    e = nt.nodes.new('ShaderNodeEmission'); e.inputs[0].default_value = (*lin((120, 228, 232)), 1); e.inputs[1].default_value = 2.2
    nt.links.new(e.outputs[0], nt.nodes['Material Output'].inputs[0])
    bpy.ops.mesh.primitive_cube_add(size=1); b = bpy.context.object; b.name = 'blade'; b.scale = (0.025, 0.025, 0.36)
    b.data.materials.append(m)
    b.parent = arm; b.parent_type = 'BONE'; b.parent_bone = 'arm-right'
    b.location = (0, BLADE_Y, 0); b.rotation_euler = (R(BLADE_RX), 0, 0)
    ld = bpy.data.lights.new('bladeL', 'POINT'); ld.color = (0.5, 0.9, 0.92); ld.energy = 0.6; ld.shadow_soft_size = 0.05
    lo = bpy.data.objects.new('bladeL', ld); sc.collection.objects.link(lo); lo.parent = b
    return b
BLADE_Y = float(os.environ.get('BLADE_Y', '0.0')); BLADE_RX = float(os.environ.get('BLADE_RX', '90'))

def combine(*parts):
    """weighted sum of (pose, weight) in order via successive blends"""
    P, w = parts[0]; acc = w
    for Q, wq in parts[1:]:
        acc += wq; P = blend(P, Q, wq/acc)
    return P

# Plans: list of (pose, extra-rotations, root z offset, root forward offset) per frame.
def plans(arm):
    idle = pose_of(arm, 'idle', 0); cr = pose_of(arm, 'crouch', 8); sp1 = pose_of(arm, 'sprint', 2); sp2 = pose_of(arm, 'sprint', 6)
    jabA = pose_of(arm, 'holding-right', 0); jabB = pose_of(arm, 'holding-right-shoot', 2)
    mr0 = pose_of(arm, 'attack-melee-right', 2); mr1 = pose_of(arm, 'attack-melee-right', 8); mr2 = pose_of(arm, 'attack-melee-right', 14)
    ml0 = pose_of(arm, 'attack-melee-left', 2); ml1 = pose_of(arm, 'attack-melee-left', 8); ml2 = pose_of(arm, 'attack-melee-left', 14)
    L = float(os.environ.get('LEAN', '1'))
    def lean(d): return {'torso': qx(d*L)}
    back = {'arm-left': qx(-55*L), 'arm-right': qx(-55*L)}
    D = {
     # anticipation (2): crouch + lean back slightly then forward; burst (4): low, stretched, arms back; recovery (2): skid, feet planted
     'dash': [(blend(idle, cr, 0.6), lean(-6), -0.02, -0.02), (cr, lean(14), -0.05, 0.0),
              (blend(cr, sp1, 0.7), {**lean(34), **back}, -0.07, 0.10), (sp1, {**lean(38), **back}, -0.07, 0.16),
              (sp2, {**lean(38), **back}, -0.07, 0.16), (blend(sp2, cr, 0.4), {**lean(28), **back}, -0.06, 0.12),
              (cr, {**lean(-14), 'arm-left': qx(30), 'arm-right': qx(30)}, -0.05, 0.04), (blend(cr, idle, 0.6), lean(-4), -0.02, 0.0)],
     # hit 1: quick jab (antic 0-1, hit 2, follow 3-5)
     'type1': [(blend(idle, jabA, 0.6), {}, 0, -0.01), (jabA, {**lean(-6), 'arm-right': qx(25)}, 0, -0.03), (jabB, {**lean(10), 'arm-right': qx(-75)}, 0, 0.06),
               (jabB, {**lean(8), 'arm-right': qx(-70)}, 0, 0.05), (blend(jabB, idle, 0.5), lean(3), 0, 0.02), (blend(jabA, idle, 0.8), {}, 0, 0)],
     # hit 2: sideways slash
     'type2': [(blend(idle, mr0, 0.6), {'torso': qz(25)}, 0, 0), (mr0, {'torso': qz(40)}, -0.01, -0.02), (mr1, {'torso': qz(-35)}, -0.01, 0.05),
               (mr1, {'torso': qz(-50)}, -0.01, 0.06), (mr2, {'torso': qz(-25)}, 0, 0.04), (blend(mr2, idle, 0.6), {}, 0, 0.01)],
     # hit 3: heavier overhead slam (antic 0-2, hit 3, follow 4-7)
     'type3': [(blend(idle, ml0, 0.5), lean(-6), 0, 0), (ml0, {**lean(-14), 'arm-right': qx(150), 'arm-left': qx(140)}, 0.03, -0.03),
               (ml0, {**lean(-18), 'arm-right': qx(170), 'arm-left': qx(160)}, 0.05, -0.04), (blend(cr, ml1, 0.5), {**lean(30), 'arm-right': qx(-60), 'arm-left': qx(-50)}, -0.06, 0.08),
               (cr, {**lean(32), 'arm-right': qx(-70), 'arm-left': qx(-60)}, -0.07, 0.09), (cr, {**lean(24), 'arm-right': qx(-55)}, -0.06, 0.08),
               (blend(cr, idle, 0.4), lean(10), -0.03, 0.04), (blend(cr, idle, 0.85), {}, 0, 0.01)],
    }
    return D

def render(path):
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)

rig()
root, arm, meshes = build_noor()
# ---- art-v7b: secondary motion. The bun lumps, flyaway loops, pencil and face locks are separate objects on the head bone;
# regroup them under pivots so the dash can trail them in the burst and let them overshoot + settle in the recovery.
from mathutils import Matrix
bpy.context.view_layer.update()
hd = [o for o in bpy.data.objects if o.parent == arm and o.parent_type == 'BONE' and o.parent_bone == 'head']
lumps = [o for o in hd if o.type == 'MESH' and o.name.startswith('Ico')]
bc = sum((o.matrix_world.translation for o in lumps), Vector())/max(1, len(lumps))
strands = [o for o in hd if o.type == 'CURVE']
fly = [o for o in strands if (o.matrix_world @ o.data.splines[0].bezier_points[0].co).z > 0.6]
locks = [o for o in strands if o not in fly]
pencil = [o for o in bpy.data.objects if o.name.startswith('pencil') and o.type == 'EMPTY']
def pivot(name, at, kids):
    pv = bpy.data.objects.new(name, None); sc.collection.objects.link(pv); pv.location = at
    bpy.context.view_layer.update(); pv.parent = arm; pv.parent_type = 'BONE'; pv.parent_bone = 'head'; pv.matrix_world = Matrix.Translation(at)
    bpy.context.view_layer.update()
    for o in kids: mw = o.matrix_world.copy(); o.parent = pv; o.parent_type = 'OBJECT'; o.matrix_world = mw
    return pv
BUN = pivot('bun_pivot', bc - Vector((0, 0, 0.04)), lumps + fly + pencil)
LOCKS = [pivot('lock_pivot', (o.matrix_world @ o.data.splines[0].bezier_points[0].co), [o]) for o in locks]
# per-frame trail (deg): dash antic, burst (trailing), skid (overshoot forward), settle
TRAIL = {'dash': [-6, -14, 36, 52, 58, 42, -22, 6]}
def hair(an, k):
    bpy.context.view_layer.update()
    ang = TRAIL.get(an, [0]*16)[k] * float(os.environ.get('HAIRSIGN', '1')) * float(os.environ.get('HAIRAMP', '1'))
    right = (root.matrix_world.to_3x3() @ Vector((1, 0, 0))).normalized()
    for pv, f in [(BUN, 1.0)] + [(l, 0.7) for l in LOCKS]:
        pv.matrix_basis = Matrix.Identity(4); pv.matrix_parent_inverse = pv.matrix_parent_inverse  # reset to rest on the bone
    bpy.context.view_layer.update()
    for pv, f in [(BUN, 1.0)] + [(l, 0.7) for l in LOCKS]:
        mw = pv.matrix_world.copy(); p0 = mw.translation.copy()
        rot = Matrix.Rotation(R(ang*f), 4, right)
        pv.matrix_world = Matrix.Translation(p0) @ rot @ Matrix.Translation(-p0) @ mw
    bpy.context.view_layer.update()
blade = caret_blade(arm)
PL = plans(arm)
for an in ANIMS:
    for dn in DIRS:
        root.rotation_euler = (0, 0, R(ROT[dn])); yaw = R(ROT[dn])
        for k, (P, ex, dz, fwd) in enumerate(PL[an][:int(os.environ.get('NMAX', 99))]):
            apply(arm, P, ex)
            # forward offset in the facing direction (character faces -Y at rz=0, i.e. towards the camera)
            root.location = (-math.sin(yaw)*fwd*0 , 0, dz)
            blade.hide_render = (an == 'dash'); hair(an, k)
            render(os.path.join(OUT, '%s_%s_%02d.png' % (an, dn, k)))
print('DONE noor7')
