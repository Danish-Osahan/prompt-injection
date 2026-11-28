# art-v13 GB-5: the Flooded Archive cast, rendered on the game's 3/4 sprite camera (ortho, 38 deg pitch, yaw 0,
# 1280/8.4 px per unit at 1x, rendered at 2x). Original modelling from primitives + Kenney CC0 parts
# (Mini Characters 'character-male-c' for Dez; Furniture Kit desk / chairDesk / computerScreen / lampSquareTable).
#   dez_asleep   Dez slumped over his filed desk, desk lamp on
#   dez_awake    the same desk, chair pushed back, Dez standing at its right end (hand out to the winch)
#   dez_portrait head and shoulders, front, for the dialogue box
#   keeper_awake / keeper_asleep   the Keeper: stilts in the water, a stack of archive boxes, a card-catalogue drawer head
#   keeper_lantern                 the lamp it holds (the game draws the pole and swings it)
# usage: blender -b --python archive13.py -- OUTDIR [what,...] [samples]
import bpy, math, sys, os, json
from mathutils import Vector, Matrix, Euler, Quaternion
argv = sys.argv[sys.argv.index('--') + 1:]; OUT = argv[0]; os.makedirs(OUT, exist_ok=True)
WHAT = argv[1].split(',') if len(argv) > 1 else ['dez_asleep', 'dez_awake', 'dez_portrait', 'keeper_awake', 'keeper_asleep', 'keeper_lantern']
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
R = math.radians
PXU = 1280 / 8.4; SS = 2
MC = '/workspace/games/_downloads/mini-characters/Models/GLB format/'
FK = '/workspace/games/_downloads/furniture-kit/Models/GLTF format/'

def L3(c): return tuple(((v / 255) ** 2.2) for v in c)
def mat(name, rgb, rough=0.7, metal=0.0, emit=0.0, emit_rgb=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*L3(rgb), 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit: b.inputs['Emission Color'].default_value = (*L3(emit_rgb or rgb), 1); b.inputs['Emission Strength'].default_value = emit
    return m
def box(name, loc, size, m, rot=(0, 0, 0), parent=None, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0)); o = bpy.context.object; o.name = name; o.scale = size
    o.rotation_euler = rot; o.location = loc; o.data.materials.append(m)
    if bevel:
        md = o.modifiers.new('bv', 'BEVEL'); md.width = bevel; md.segments = 2; md.limit_method = 'ANGLE'
    if parent: o.parent = parent
    return o
def empty(name, loc=(0, 0, 0), parent=None, rot=(0, 0, 0)):
    o = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(o); o.location = loc; o.rotation_euler = rot
    if parent: o.parent = parent
    return o
def glb(path, loc=(0, 0, 0), rotz=0.0, scale=1.0, parent=None, centre=False):
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=path); new = [o for o in bpy.data.objects if o not in before]
    top = [o for o in new if o.parent is None]
    holder = empty('h_' + os.path.basename(path), (0, 0, 0), None)
    for o in top: o.parent = holder
    if centre:   # footprint centred on the holder origin, base at z 0
        bpy.context.view_layer.update()
        pts = [o.matrix_world @ Vector(c) for o in new if o.type == 'MESH' for c in o.bound_box]
        cx = (min(p.x for p in pts) + max(p.x for p in pts)) / 2; cy = (min(p.y for p in pts) + max(p.y for p in pts)) / 2; z0 = min(p.z for p in pts)
        for o in top: o.location = o.location - Vector((cx, cy, z0))
    holder.location = loc; holder.rotation_euler = (0, 0, rotz); holder.scale = (scale,) * 3
    if parent: holder.parent = parent
    return holder, new

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 4; sc.render.film_transparent = True
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
    sc.render.image_settings.color_mode = 'RGBA'
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.006, 0.010, 0.016, 1)
    return sc

def camera(sc, W, H, centre, ortho=None):
    """3/4 ortho camera. centre = world point placed at the image centre. W,H in 1x px."""
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = ortho or (max(W, H) / PXU); cd.clip_end = 100
    cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
    t = R(90 - 38); cam.rotation_euler = (t, 0, 0)
    d = Vector((0, math.sin(t), -math.cos(t)))
    cam.location = Vector(centre) - d * 20
    sc.render.resolution_x = W * SS; sc.render.resolution_y = H * SS
    return cam

def px(sc, cam, v):
    from bpy_extras.object_utils import world_to_camera_view
    q = world_to_camera_view(sc, cam, Vector(v)); W = sc.render.resolution_x / SS; H = sc.render.resolution_y / SS
    return [round(q.x * W, 1), round((1 - q.y) * H, 1)]

def light(kind, loc, energy, col, size=0.5, rot=(0, 0, 0), shadow=True):
    ld = bpy.data.lights.new(kind, kind); ld.energy = energy; ld.color = col; ld.cycles.cast_shadow = shadow
    if kind == 'AREA': ld.size = size
    if kind == 'POINT': ld.shadow_soft_size = size
    if kind == 'SUN': ld.angle = R(size)
    o = bpy.data.objects.new(kind, ld); bpy.context.scene.collection.objects.link(o); o.location = loc; o.rotation_euler = rot; return o

def archive_light(warm_at=None, warm=40.0):
    # the room's three lights as they fall on the cast: a cold high window (back), a dim cool fill from the camera,
    # and (optionally) a warm local lamp
    light('SUN', (0, 0, 5), 1.2, (0.55, 0.78, 0.92), 12, (R(-38), R(12), R(8)))        # cold window, from behind/above
    light('SUN', (0, 0, 5), FILL, (0.40, 0.52, 0.70), 30, (R(48), 0, R(-20)), False)   # faint cool fill, camera side
    if warm_at: light('POINT', warm_at, warm, (1.0, 0.72, 0.42), 0.06)

def save(sc, name, meta=None):
    sc.render.filepath = os.path.join(OUT, name + '.png'); bpy.ops.render.render(write_still=True)
    if meta is not None: json.dump(meta, open(os.path.join(OUT, name + '.json'), 'w'), indent=1)

# ------------------------------------------------------------------ Dez
DEZ_COL = dict()
DZS = 1.45
FILL = float(os.environ.get('FILL', 1.1))
DZ_Y, DZ_Z = float(os.environ.get('DZ_Y', 0)), float(os.environ.get('DZ_Z', 0.12))
def _v(k, d): return tuple(float(a) for a in os.environ.get(k, d).split(','))
TORSO = _v('TORSO', '30,0,0'); HEADB = _v('HEADB', '10,0,60'); ARML = _v('ARML', '-90,0,30'); ARMR = _v('ARMR', '-90,0,-30')
def dez_char(loc, rotz, action='idle', frame=0.0):
    h, new = glb(MC + 'character-male-a.glb', loc, rotz)
    for o in new:
        if o.type in ('CAMERA', 'LIGHT') or (o.type == 'MESH' and o.parent is None and o.name.startswith('Ico')): bpy.data.objects.remove(o, do_unlink=True)
    arm = [o for o in new if o.type == 'ARMATURE' and o.name in bpy.data.objects][0]
    acts = {a.name.split('_')[0]: a for a in bpy.data.actions}
    arm.animation_data_create(); arm.animation_data.action = acts[action]
    fr = acts[action].frame_range; bpy.context.scene.frame_set(int(fr[0] + (fr[1] - fr[0]) * frame))
    bpy.context.view_layer.update()
    basis = {pb.name: pb.matrix_basis.copy() for pb in arm.pose.bones}
    arm.animation_data.action = None
    for pb in arm.pose.bones: pb.matrix_basis = basis[pb.name]
    # lanyard strap (coral) down the chest; the ID card itself is drawn by the game
    lm = mat('dz_lany', (196, 92, 80), 0.6)
    meshes = [o for o in new if o.type == 'MESH' and o.name in bpy.data.objects]
    return h, arm, meshes, lm

def bend(arm, bone, rx=0, ry=0, rz=0):
    pb = arm.pose.bones[bone]; q = Euler((R(rx), R(ry), R(rz))).to_quaternion()
    pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = pb.rotation_quaternion @ q

def desk_set(parent_loc=(0, 0, 0), chair_back=0.0, awake=False):
    # desk centred on (x, y): front edge at y - 0.19 faces the camera; Dez sits behind it (y + 0.45) facing the camera
    x, y = parent_loc[0], parent_loc[1]
    glb(FK + 'desk.glb', (x, y, 0), 0, centre=True)
    glb(FK + 'computerScreen.glb', (x - 0.27, y + 0.06, 0.384), R(215), centre=True)
    glb(FK + 'lampSquareTable.glb', (x + 0.27, y + 0.07, 0.384), 0, centre=True)
    if False: glb(FK + 'chairDesk.glb', (x + 0.06 + (0.12 if awake else 0), y + 0.40 + chair_back, 0), R(180) + (R(-25) if awake else 0), centre=True)
    note = mat('note', (232, 214, 120), 0.6); box('note', (x - 0.31, y + 0.02, 0.64), (0.07, 0.004, 0.06), note, (0, 0, R(-20)))
    return (x + 0.27, y + 0.07, 0.384 + 0.25)   # lamp bulb (warm light)

def render_dez(kind):
    sc = reset()
    if kind == 'dez_portrait':
        cam = camera(sc, 160, 160, (0, 0, 0.52), ortho=0.56)
        h, arm, meshes, lm = dez_char((0, 0, 0), 0, 'idle', 0.0)
        cam.rotation_euler = (R(90 - 12), 0, 0); t = R(90 - 12); d = Vector((0, math.sin(t), -math.cos(t))); cam.location = Vector((0, 0, 0.50)) - d * 20
        box('strapL', (0.035, -0.095, 0.40), (0.012, 0.006, 0.16), lm, (R(-8), 0, R(8))); box('strapR', (-0.035, -0.095, 0.40), (0.012, 0.006, 0.16), lm, (R(-8), 0, R(-8)))
        light('SUN', (0, 0, 5), 2.4, (1.0, 0.82, 0.62), 10, (R(60), 0, R(-35)))
        light('SUN', (0, 0, 5), 2.0, (0.45, 0.80, 0.92), 6, (R(-60), 0, R(50)), False)
        light('SUN', (0, 0, 5), 0.6, (0.5, 0.55, 0.9), 30, (R(80), 0, R(10)), False)
        save(sc, kind); return
    # Kenney's mini characters are small next to Noor's model: Dez and his desk render 1.45x so he stands as tall as she does
    W, H = 320, 320
    cam = camera(sc, W, H, (0.05, 0.12, 0.30), ortho=max(W, H) / (PXU * DZS))
    awake = kind == 'dez_awake'
    bulb = desk_set((0, 0, 0), chair_back=0.18 if awake else 0.0, awake=awake)
    archive_light(bulb, 9.0)
    if not awake:
        # seated in the chair behind the desk, facing the camera, slumped onto folded arms
        h, arm, meshes, lm = dez_char((0.11, 0.40 + DZ_Y, DZ_Z), R(0), 'sit', 0.0)
        bend(arm, 'torso', *TORSO); bend(arm, 'head', *HEADB)
        bend(arm, 'arm-left', *ARML); bend(arm, 'arm-right', *ARMR)
    else:
        h, arm, meshes, lm = dez_char((0.55, 0.20, 0), R(-70), 'interact-right', 0.45)
        bend(arm, 'head', -6, 0, 0)
    bpy.context.view_layer.update()
    head = arm.matrix_world @ arm.pose.bones['head'].head
    meta = dict(w=W, h=H, desk_front=px(sc, cam, (0.0, 0.0, 0.0)), desk_top=px(sc, cam, (0.0, 0.18, 0.384)), head=px(sc, cam, head),
                bulb=px(sc, cam, bulb), desk_l=px(sc, cam, (-0.36, 0.0, 0.0)), desk_r=px(sc, cam, (0.36, 0.0, 0.0)), feet=px(sc, cam, (0.55, 0.20, 0)))
    save(sc, kind, meta)

# ------------------------------------------------------------------ the Keeper
def render_keeper(kind):
    sc = reset()
    W, H = 260, 340
    cam = camera(sc, W, H, (-0.12, 0, 1.05))
    asleep = kind == 'keeper_asleep'
    iron = mat('iron', (40, 42, 46), 0.4, 0.75); kraft = mat('kraft', (150, 128, 98), 0.85); kraft2 = mat('kraft2', (124, 106, 84), 0.9)
    lab = mat('label', (214, 206, 186), 0.7); ink = mat('ink', (36, 36, 42), 0.6); oak = mat('oak', (104, 74, 50), 0.55); brass = mat('brass', (176, 142, 78), 0.35, 0.8)
    slit = mat('slit', (200, 230, 236), 0.4, emit=0.0 if asleep else 1.6, emit_rgb=(170, 220, 230)); string = mat('string', (190, 178, 150), 0.9)
    lany = mat('lany', (70, 92, 104), 0.6)
    root = empty('root')
    # stilts: two thin iron legs from the water line, an A-frame with knee blocks
    for sx in (-1, 1):
        box('stilt', (sx * 0.10, 0.0, 0.46), (0.024, 0.024, 0.95), iron, (0, R(sx * -4), 0), root)
        box('knee', (sx * 0.093, -0.01, 0.48), (0.05, 0.05, 0.05), iron, (0, 0, 0), root)
    box('hipbar', (0, 0, 0.93), (0.30, 0.05, 0.04), iron, (0, 0, 0), root)
    body = empty('body', (0, 0, 0.95), root, (R(16), R(-7), 0) if asleep else (R(-3), 0, 0))
    # torso: three archive boxes, a little out of true, string-tied, with label windows
    z = 0.0
    for i, (w, h, dx, rz) in enumerate(((0.40, 0.22, 0.0, 2), (0.36, 0.20, 0.012, -4), (0.33, 0.19, -0.01, 3))):
        b = box('abox%d' % i, (dx, 0, z + h / 2), (w, 0.27, h), kraft if i % 2 == 0 else kraft2, (0, 0, R(rz)), body, 0.006)
        box('label', (dx - 0.06, -0.137, z + h * 0.58), (0.12, 0.004, 0.06), lab, (0, 0, R(rz)), body)
        box('lbl_line', (dx - 0.06, -0.140, z + h * 0.58), (0.09, 0.003, 0.006), ink, (0, 0, R(rz)), body)
        box('hand_hole', (dx + 0.10, -0.137, z + h * 0.62), (0.06, 0.004, 0.022), ink, (0, 0, R(rz)), body)
        box('tie', (dx, 0, z + h / 2), (0.012, 0.278, h + 0.004), string, (0, 0, R(rz)), body)
        z += h
    box('yoke', (0, 0, z + 0.015), (0.56, 0.06, 0.03), iron, (0, 0, 0), body)
    neck = empty('neck', (0, 0, z + 0.03), body, (R(26), 0, R(8)) if asleep else (R(10), 0, 0))
    box('neckrod', (0, 0, 0.10), (0.024, 0.024, 0.20), iron, (0, 0, 0), neck)
    head = empty('head', (0, 0, 0.21), neck, (R(-12), 0, 0))
    box('drawer', (0, -0.06, 0.07), (0.27, 0.20, 0.15), oak, (0, 0, 0), head, 0.008)
    box('front', (0, -0.165, 0.07), (0.28, 0.02, 0.16), oak, (0, 0, 0), head, 0.004)
    # an open catalogue drawer: rows of pale index cards stand up out of it (the Keeper's 'hair')
    for i in range(7):
        box('icard', (((i * 37) % 5 - 2) * 0.004, -0.14 + i * 0.026, 0.16 + ((i * 53) % 3) * 0.008), (0.23, 0.004, 0.06), lab, (R(-8 + (i % 3) * 5), 0, 0), head)
    box('holder', (0, -0.178, 0.10), (0.11, 0.008, 0.045), brass, (0, 0, 0), head)
    box('slit', (0, -0.184, 0.10), (0.085, 0.004, 0.022), slit, (0, 0, 0), head)
    box('pull', (0, -0.186, 0.035), (0.05, 0.016, 0.018), brass, (0, 0, 0), head)
    # lanyard: two straps from the neck down to the chest (the game hangs the card at the meta 'card' point)
    box('strapL', (0.05, -0.15, z - 0.07), (0.016, 0.006, 0.17), lany, (R(-6), 0, R(12)), body)
    box('strapR', (-0.05, -0.15, z - 0.07), (0.016, 0.006, 0.17), lany, (R(-6), 0, R(-12)), body)
    card_pt = body.matrix_world @ Vector((0, -0.155, z - 0.16))
    # arms: long iron rods. Awake: the right arm (screen left) reaches out to hold the lamp pole; the other hangs.
    for sx in (-1, 1):
        sh = empty('sh', (sx * 0.27, 0, z), body)
        if sx < 0 and not asleep:
            sh.rotation_euler = (R(-20), R(48), 0)
        elif sx < 0:
            sh.rotation_euler = (R(-10), R(18), 0)
        else:
            sh.rotation_euler = (0, R(-8), 0)
        box('upper', (0, 0, -0.17), (0.026, 0.026, 0.34), iron, (0, 0, 0), sh)
        el = empty('el', (0, 0, -0.34), sh, (R(-35), R(0), 0) if sx < 0 and not asleep else (R(8), 0, 0))
        box('fore', (0, 0, -0.15), (0.022, 0.022, 0.30), iron, (0, 0, 0), el)
        box('grip', (0, 0, -0.31), (0.04, 0.04, 0.04), iron, (0, 0, 0), el)
        if sx < 0: hand = empty('hand', (0, 0, -0.31), el)
    archive_light((-0.55, -0.35, 1.0) if not asleep else (-0.25, -0.30, 0.15), 30 if not asleep else 14)
    bpy.context.view_layer.update()
    meta = dict(w=W, h=H, foot=px(sc, cam, (0, 0, 0)), hand=px(sc, cam, hand.matrix_world.translation), card=px(sc, cam, card_pt),
                head=px(sc, cam, head.matrix_world.translation), stiltL=px(sc, cam, (-0.10, 0, 0)), stiltR=px(sc, cam, (0.10, 0, 0)))
    save(sc, kind, meta)

def render_lantern():
    sc = reset(); W, H = 48, 64
    cam = camera(sc, W, H, (0, 0, -0.06))
    iron = mat('iron', (40, 42, 46), 0.4, 0.75); glass = mat('glass', (255, 214, 150), 0.2, emit=7.0, emit_rgb=(255, 206, 140))
    box('top', (0, 0, 0.0), (0.12, 0.12, 0.02), iron); box('ringbar', (0, 0, 0.025), (0.02, 0.02, 0.03), iron)
    for sx in (-1, 1):
        for sy in (-1, 1): box('post', (sx * 0.05, sy * 0.05, -0.08), (0.012, 0.012, 0.16), iron)
    box('glass', (0, 0, -0.08), (0.085, 0.085, 0.14), glass); box('base', (0, 0, -0.165), (0.12, 0.12, 0.02), iron)
    light('SUN', (0, 0, 5), 0.6, (0.55, 0.78, 0.92), 12, (R(-38), 0, 0))
    meta = dict(w=W, h=H, hook=px(sc, cam, (0, 0, 0.04)), glow=px(sc, cam, (0, 0, -0.08)))
    save(sc, 'keeper_lantern', meta)

for k in WHAT:
    if k.startswith('dez'): render_dez(k)
    elif k == 'keeper_lantern': render_lantern()
    elif k.startswith('keeper'): render_keeper(k)
print('ARCHIVE13 DONE', WHAT)
