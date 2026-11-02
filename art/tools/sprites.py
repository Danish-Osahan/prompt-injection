# art-v6 (calm attack FX: teal keys, amber/ice shards, warm bolt, soft ice ring). was art-v5: render Noor's sprite frames (8 directions) at the game's 3/4 camera (ortho, 38 deg elevation, same px/unit as the
# 1280x720 mocks: ortho 8.4 / 1280 px), neon-noir rig fixed to the camera. Frames are rendered at 2x and downsampled in pack.py.
# usage: blender -b --python sprites.py -- ANIMS(idle,walk,attack|shard) OUTDIR [SAMPLES] [DIRS]
import bpy, sys, math, os
from mathutils import Vector, Quaternion
argv = sys.argv[sys.argv.index('--')+1:]
ANIMS = argv[0].split(','); OUT = argv[1]; SAMPLES = int(argv[2]) if len(argv) > 2 else 24
DIRS = argv[3].split(',') if len(argv) > 3 else ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW']
T = '/workspace/games/prompt-injection/art-v7/tools/'
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

# ---------- attack FX (holo keyboard + prompt shards), children of the character root ----------
def fx(root):
    from bpy_extras import object_utils
    def glow(name, rgb, strength, tex=None):
        m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
        for n in list(nt.nodes):
            if n.type != 'OUTPUT_MATERIAL': nt.nodes.remove(n)
        em = nt.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = (*lin(rgb), 1); em.inputs[1].default_value = strength
        tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
        val = nt.nodes.new('ShaderNodeValue'); val.name = 'fade'; val.outputs[0].default_value = 1.0
        mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; nt.links.new(val.outputs[0], mul.inputs[1])
        if tex:
            t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(V4+'tex/'+tex+'.png', check_existing=True)
            bw = nt.nodes.new('ShaderNodeRGBToBW'); nt.links.new(t.outputs[0], bw.inputs[0])
            ad = nt.nodes.new('ShaderNodeMath'); ad.operation = 'MULTIPLY_ADD'; ad.inputs[1].default_value = 0.8; ad.inputs[2].default_value = 0.18
            nt.links.new(bw.outputs[0], ad.inputs[0]); nt.links.new(ad.outputs[0], mul.inputs[0])
        else: mul.inputs[0].default_value = 1.0
        nt.links.new(mul.outputs[0], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2])
        nt.links.new(mx.outputs[0], nt.nodes['Material Output'].inputs[0]); m.blend_method = 'BLEND'; return m
    bpy.ops.mesh.primitive_plane_add(size=1); kb = bpy.context.object; kb.name = 'holokb'
    kb.scale = (0.46, 0.16, 1); kb.parent = root; kb.location = (0, -0.25, 0.30); kb.rotation_euler = (R(-28), 0, 0)
    kb.data.materials.append(glow('kbm', (120, 206, 214), 0.85, 'holokeys'))
    bpy.ops.mesh.primitive_plane_add(size=1); fr = bpy.context.object; fr.name = 'kbframe'; fr.parent = kb; fr.location = (0, 0, -0.002); fr.scale = (1.08, 1.2, 1)
    fr.data.materials.append(glow('kbf', (40, 70, 110), 0.35))
    shards = []
    for i, (g, col) in enumerate((('glyph0', (230, 160, 84)), ('glyph1', (214, 240, 246)), ('glyph4', (230, 160, 84)), ('glyph2', (214, 240, 246)))):
        bpy.ops.mesh.primitive_cube_add(size=1); c = bpy.context.object; c.scale = (0.10, 0.10, 0.04); c.parent = root
        c.data.materials.append(glow('sh%d' % i, col, 0.6))
        bpy.ops.mesh.primitive_plane_add(size=1); tp = bpy.context.object; tp.parent = c; tp.location = (0, 0, 0.52); tp.scale = (0.9, 0.9, 1)
        tp.data.materials.append(glow('sht%d' % i, col, 1.2, g)); shards.append(c)
    # merged 'prompt' bolt: a bigger keycap with '>_' that launches forward
    bpy.ops.mesh.primitive_cube_add(size=1); bolt = bpy.context.object; bolt.scale = (0.16, 0.16, 0.06); bolt.parent = root
    bolt.data.materials.append(glow('boltm', (200, 130, 70), 0.7))
    bpy.ops.mesh.primitive_plane_add(size=1); bt = bpy.context.object; bt.parent = bolt; bt.location = (0, 0, 0.52)
    bt.data.materials.append(glow('boltt', (255, 210, 150), 1.5, 'glyph0'))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.12, minor_radius=0.012, major_segments=40, minor_segments=6); ring = bpy.context.object; ring.parent = root
    ring.data.materials.append(glow('ringm', (170, 232, 238), 1.4)); ring.rotation_euler = (R(90), 0, 0)
    ld = bpy.data.lights.new('fxL', 'POINT'); ld.color = (1.0, 0.78, 0.52); ld.shadow_soft_size = 0.05
    fl = bpy.data.objects.new('fxL', ld); sc.collection.objects.link(fl); fl.parent = root
    ld2 = bpy.data.lights.new('kbL', 'POINT'); ld2.color = (0.55, 0.85, 0.9); ld2.shadow_soft_size = 0.1
    kl = bpy.data.objects.new('kbL', ld2); sc.collection.objects.link(kl); kl.parent = root; kl.location = (0, -0.28, 0.36)
    return dict(kb=kb, shards=shards, bolt=bolt, light=fl, kblight=kl, ring=ring)

def fade(o, v):
    for ob in [o] + list(o.children):
        for sl in ob.material_slots:
            n = sl.material.node_tree.nodes.get('fade')
            if n: n.outputs[0].default_value = v
    vis = v > 0.01
    for ob in [o] + list(o.children): ob.hide_render = not vis

def attack_frame(arm, F, k):
    idle = pose_of(arm, 'idle', 0); hb = pose_of(arm, 'holding-both', 0)
    sh1 = pose_of(arm, 'holding-both-shoot', 1.2); sh2 = pose_of(arm, 'holding-both-shoot', 3.0)
    tl = {'arm-left': qx(-14), 'arm-right': qx(6)}; tr = {'arm-left': qx(6), 'arm-right': qx(-14)}
    lean = {'torso': qx(6)}
    plan = [(blend(idle, hb, 0.55), {}, 0.35, 0.0), (hb, lean, 1.0, 0.0), (hb, {**lean, **tl}, 1.0, 0.2), (hb, {**lean, **tr}, 1.0, 0.45),
            (hb, {**lean, **tl}, 1.0, 0.7), (sh1, {'torso': qx(-4)}, 0.8, 1.0), (sh2, {}, 0.4, 1.4), (blend(sh2, idle, 0.6), {}, 0.0, 2.0)]
    P, ex, kbv, ph = plan[k]; apply(arm, P, ex)
    fade(F['kb'], kbv); F['kb'].scale = (0.40*(0.6+0.4*kbv), 0.14*(0.6+0.4*kbv), 1)
    F['kblight'].data.energy = 1.2*kbv
    for i, c in enumerate(F['shards']):
        t = ph - i*0.12   # shards pop out of the keyboard one after another and converge into the bolt
        if 0 < t < 1.0:
            a = i*1.7; c.location = (0.16*math.cos(a)*(1-t), -0.30 - 0.10*t, 0.36 + 0.22*t + 0.05*math.sin(a))
            c.rotation_euler = (R(60+40*t), R(25*i), R(70*t*(i+1))); fade(c, min(1.0, 2.2*(1-t)+0.3))
        else: fade(c, 0.0)
    b = F['bolt']
    if ph >= 1.0 and ph < 2.0:
        u = ph - 1.0; b.location = (0, -0.40 - 0.22*u, 0.44 - 0.04*u); b.rotation_euler = (R(70), 0, R(200*u)); fade(b, 1.0)
        F['light'].location = b.location; F['light'].data.energy = 3.5
    else: fade(b, 0.0); F['light'].data.energy = 0.0
    rg = F['ring']   # expanding cast ring at the moment of release
    if 0.95 <= ph < 1.6:
        u = (ph - 1.0)/0.4; rg.location = (0, -0.36, 0.40); sc_ = 0.8 + 1.4*u; rg.scale = (sc_, sc_, sc_); fade(rg, 0.75 - 0.55*u)
    else: fade(rg, 0.0)

def render(path):
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)

rig()
if 'shard' in ANIMS:   # projectile: 8-frame spinning '>_' keycap, direction-agnostic
    root = bpy.data.objects.new('r', None); sc.collection.objects.link(root)
    F = fx(root); fade(F['kb'], 0)
    for c in F['shards']: fade(c, 0)
    fade(F['ring'], 0)
    b = F['bolt']; fade(b, 1.0); F['light'].data.energy = 6.0
    sc.render.resolution_x = sc.render.resolution_y = 96*SS
    sc.camera.data.ortho_scale = 96/PX_PER_UNIT
    t = R(52); d = Vector((0, math.sin(t), -math.cos(t))); sc.camera.location = Vector((0, 0, 0.3)) - d*10
    for o in [o for o in bpy.data.objects if o.type == 'MESH' and o.is_shadow_catcher]: o.hide_render = True
    for k in range(8):
        b.location = (0, 0, 0.3); b.rotation_euler = (R(60), R(10*math.sin(k)), R(k*45)); F['light'].location = (0, -0.1, 0.3)
        render(os.path.join(OUT, 'shard_%02d.png' % k))
    sys.exit(0)
root, arm, meshes = build_noor()
F = fx(root) if 'attack' in ANIMS else None
if F: attack_frame(arm, F, 7); fade(F['kb'], 0)
for an in ANIMS:
    for dn in DIRS:
        root.rotation_euler = (0, 0, R(ROT[dn]))
        if an == 'idle':
            frames = [(None, i*32/6) for i in range(6)]
        elif an == 'walk':
            frames = [(None, i*2) for i in range(8)]
        else:
            frames = list(range(8))
        for k, fr in enumerate(frames[:int(os.environ.get('NMAX', 99))]):
            if an == 'attack': attack_frame(arm, F, fr)
            else:
                if F:
                    fade(F['kb'], 0); fade(F['bolt'], 0); fade(F['ring'], 0); [fade(c, 0) for c in F['shards']]; F['light'].data.energy = 0; F['kblight'].data.energy = 0
                apply(arm, pose_of(arm, an, fr[1]))
            render(os.path.join(OUT, '%s_%s_%02d.png' % (an, dn, k)))
print('DONE sprites')
