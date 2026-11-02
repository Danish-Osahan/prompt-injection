# art-v6 CALM room builder: scene5 helpers + v6 rooms (rooms6_*.py). usage: blender -b --python scene6.py -- R8 OUTDIR W H [SAMPLES]
# usage: blender -b --python scene5.py -- MODE(room2|room1|room3|castN|castF|castB) OUTDIR W H [SAMPLES]
#   room2 = Floor 2 Open Plan (combat), room1 = Floor 1 Archive (combat), room3 = Floor 2 break room (quiet exploration)
# Calm-level rules (see README): props in a few deliberate clusters along the walls, clear empty walkable floor,
# few word tiles with clear spacing, deep teal/indigo base + warm lamp pools, neon only as a sparing accent,
# actors lit by the shared actor rig (rig5.py, light-linked) so they match the sprite sheets and pop off the set.
import bpy, sys, math, random, os, mathutils
from mathutils import Vector, Matrix, Euler, Quaternion
argv = sys.argv[sys.argv.index('--')+1:]
MODE, OUT = argv[0], argv[1]; W, H = int(argv[2]), int(argv[3]); SAMPLES = int(argv[4]) if len(argv) > 4 else 48
V5 = '/workspace/games/prompt-injection/art-v5/'; T5 = os.path.dirname(os.path.abspath(sys.argv[sys.argv.index('--python')+1])) + '/'; TX6 = '/workspace/games/prompt-injection/art-v6/tex/'; TX = V5+'tex/v3/'; TX5 = V5+'tex/'
FK = '/workspace/games/_downloads/furniture-kit/Models/GLTF format/'
os.makedirs(OUT, exist_ok=True); random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; R = math.radians
exec(open(T5+'noor.py').read()); exec(open(T5+'fern.py').read()); exec(open(T5+'enemies.py').read()); exec(open(T5+'enemies6.py').read()); exec(open(T5+'rig5.py').read())
ROOM = MODE.startswith('room') or MODE.startswith('R'); FLOOR = {'room1': 1, 'room2': 2, 'room3': 3}.get(MODE, 0)
CAM_YAW = -30; SCR_RZ = 30.0          # objects rotated by SCR_RZ face the room camera square-on ("S")
ROT = dict(S=0, SE=45, E=90, NE=135, N=180, NW=225, W=270, SW=315)
IDX = dict(env=15, tile=10, plate=11, pickup=12)
WORLD = (0.010, 0.016, 0.030)
CAM_T = (0.3, 1.55)                  # room camera target (v4: 0.3, 1.2); same ortho/pitch/yaw as the sprites        # same as the sprite rig world -> actors match their sheets

# ---------------- helpers ----------------
CACHE = {}; PROP_MATS = set(); WARM_MATS = set()
def load(path):
    if path in CACHE: return CACHE[path]
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]; col = bpy.data.collections.new('src_'+os.path.basename(path))
    for o in new:
        for c in list(o.users_collection): c.objects.unlink(o)
        col.objects.link(o)
    CACHE[path] = col; return col
def prop(name, x, y, rz=0, s=1.0, z=0.0, index=0, parent=None):
    col = load(FK+name+'.glb'); root = bpy.data.objects.new(name, None); sc.collection.objects.link(root); m = {}
    for o in col.objects:
        c = o.copy(); m[o] = c; sc.collection.objects.link(c); c.pass_index = index
        for sl in c.material_slots:
            if sl.material: PROP_MATS.add(sl.material)
    for o, c in m.items():
        c.parent = m[o.parent] if o.parent in m else root
        if o.parent not in m: c.matrix_parent_inverse = Matrix.Identity(4)
    root.location = (x, y, z); root.rotation_euler = (0, 0, R(rz)); root.scale = (s, s, s)
    if parent: root.parent = parent
    return root
def col_mat(name, rgb, emit=0.0, rough=0.5, metal=0.0):   # rgb linear
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit > 0: b.inputs['Emission Color'].default_value = (*rgb, 1); b.inputs['Emission Strength'].default_value = emit
    return m
def srgb(name, rgb, **kw): return col_mat(name, L3(rgb), **kw)
def img_mat(name, path, emit=0.0, rough=0.6, interp='Linear'):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(path, check_existing=True); t.interpolation = interp
    nt.links.new(t.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = rough
    if emit > 0: nt.links.new(t.outputs['Color'], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = emit
    return m
def emit_mat(name, rgb, strength):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL': nt.nodes.remove(n)
    e = nt.nodes.new('ShaderNodeEmission'); e.inputs[0].default_value = (*L3(rgb), 1); e.inputs[1].default_value = strength
    nt.links.new(e.outputs[0], nt.nodes['Material Output'].inputs[0]); return m
def plane(name, w, h, mat, loc, rot=(0, 0, 0), index=0):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot); o = bpy.context.object; o.name = name; o.scale = (w, h, 1)
    o.data.materials.append(mat); o.pass_index = index; return o
def box(name, dims, loc, mat, bevel=0.0, rot=(0, 0, 0), index=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot); o = bpy.context.object; o.name = name; o.scale = dims
    o.data.materials.append(mat); o.pass_index = index
    if bevel:
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True); md = o.modifiers.new('bv', 'BEVEL'); md.width = bevel; md.segments = 2
    return o
ROOM_LIGHTS = []
def light(kind, loc, energy, color, size=0.5, rot=(0, 0, 0), spot=None, blend=0.7):
    ld = bpy.data.lights.new(kind+str(len(bpy.data.lights)), kind); ld.energy = energy; ld.color = color
    if kind == 'AREA': ld.size = size
    if kind in ('POINT', 'SPOT'): ld.shadow_soft_size = size
    if kind == 'SUN': ld.angle = R(size)
    if spot: ld.spot_size = R(spot); ld.spot_blend = blend
    o = bpy.data.objects.new(ld.name, ld); o.location = loc; o.rotation_euler = rot; sc.collection.objects.link(o); ROOM_LIGHTS.append(o); return o
def aim(o, target):
    d = Vector(target) - o.location; o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

def TILEP(w):
    p = TX6+'sign_'+w+'.png'
    return p if os.path.exists(p) else TX5+'tile_'+w+'.png'
def rule_tiles(words, cx, cy, h=0.24, z=0.0, floating=False, rz=SCR_RZ, emit=0.85):
    """Legible rule plates: one chunky tile per word, tilted towards the camera. Calm: no glow line, no extra lights."""
    if os.environ.get('NOTILES'):   # clean plate for the UI redesign: log where the phrase goes, build nothing
        EXTRA_LOG.setdefault('tiles', []).append(dict(words=words, x=cx, y=cy, z=z, h=h, floating=floating, rz=rz))
        e = bpy.data.objects.new('rule', None); sc.collection.objects.link(e); return e
    root = bpy.data.objects.new('rule', None); sc.collection.objects.link(root); root.location = (cx, cy, z); root.rotation_euler = (0, 0, R(rz))
    body = srgb('tilebody', (34, 24, 20), rough=0.6, metal=0.0); ws = []
    for w in words:
        img = bpy.data.images.load(TILEP(w), check_existing=True); ws.append((w, h*img.size[0]/img.size[1]))
    gap = 0.09; total = sum(a for _, a in ws) + gap*(len(ws)-1); x = -total/2; tilt = 52 if floating else 40
    idx = IDX['plate'] if floating else IDX['tile']
    for w, tw in ws:
        e = bpy.data.objects.new('tile', None); sc.collection.objects.link(e); e.parent = root
        e.location = (x + tw/2, 0, 0 if floating else h/2*math.sin(R(tilt)) + 0.012); e.rotation_euler = (R(tilt), 0, 0)
        b = box('tileb', (tw, h, 0.05), (0, 0, 0), body, bevel=0.012, index=idx); b.parent = e; b.location = (0, 0, -0.026)
        t = plane('tilet', tw*0.98, h*0.97, img_mat('tile_'+w, TILEP(w), emit=emit, rough=0.5), (0, 0, 0), index=idx); t.parent = e; t.location = (0, 0, 0.0015)
        x += tw + gap
    root['width'] = total; return root

def pendant(x, y, z=1.9, col=(1.0, 0.74, 0.48), energy=60, spot=70):
    shade = srgb('shade', (20, 26, 34), rough=0.45, metal=0.4); inner = emit_mat('shadein', (255, 210, 150), 3.0)
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.17, radius2=0.05, depth=0.14, end_fill_type='NOTHING', location=(x, y, z)); c = bpy.context.object
    c.data.materials.append(shade); md = c.modifiers.new('s', 'SOLIDIFY'); md.thickness = 0.01; c.pass_index = IDX['env']
    bpy.ops.mesh.primitive_circle_add(vertices=24, radius=0.16, fill_type='NGON', location=(x, y, z-0.065)); d = bpy.context.object; d.data.materials.append(inner)
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.006, depth=4.0, location=(x, y, z+2.07)); w = bpy.context.object; w.data.materials.append(shade)
    return light('SPOT', (x, y, z-0.08), energy, col, 0.25, spot=spot, blend=0.9)

def tune_props(sat=0.60, val=0.70, tint=(0.78, 0.92, 1.0)):
    """calm prop grade: lower saturation, slightly darker, cool teal multiply (warm lamps keep their own emission)"""
    for m in PROP_MATS:
        if m.get('tuned') or not m.use_nodes: continue
        m['tuned'] = 1; nt = m.node_tree; b = nt.nodes.get('Principled BSDF')
        if not b: continue
        inp = b.inputs['Base Color']
        if inp.links: src = inp.links[0].from_socket
        else:
            rgb = nt.nodes.new('ShaderNodeRGB'); rgb.outputs[0].default_value = inp.default_value; src = rgb.outputs[0]
        hsv = nt.nodes.new('ShaderNodeHueSaturation'); hsv.inputs['Saturation'].default_value = m.get('sat', sat); hsv.inputs['Value'].default_value = m.get('val', val)
        nt.links.new(src, hsv.inputs['Color'])
        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs[0].default_value = 1.0
        nt.links.new(hsv.outputs[0], mix.inputs[6]); mix.inputs[7].default_value = (*tint, 1); nt.links.new(mix.outputs[2], inp)
        b.inputs['Roughness'].default_value = max(b.inputs['Roughness'].default_value, 0.55)

def books_row(xx, yy, levels, parent=None):
    for lvl in levels:
        bx = 0.04
        while bx < 0.68:
            prop('books', xx+bx, yy+0.04, 0, z=lvl, s=1.5, parent=parent); bx += 0.17

# ---------------- shell: slab, walls, floor ----------------
def shell(floor_tex='floor_calm.png', wall=(22, 40, 52), trim=(14, 26, 36), tile_m=4.0):
    fm = img_mat('floor', TX5+floor_tex, rough=0.42)
    nt = fm.node_tree; nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.2; nz.inputs['Detail'].default_value = 2
    cr = nt.nodes.new('ShaderNodeValToRGB'); cr.color_ramp.elements[0].position = 0.35; cr.color_ramp.elements[0].color = (0.30, 0.30, 0.30, 1)
    cr.color_ramp.elements[1].position = 0.7; cr.color_ramp.elements[1].color = (0.55, 0.55, 0.55, 1)
    tc = nt.nodes.new('ShaderNodeTexCoord'); nt.links.new(tc.outputs['Object'], nz.inputs['Vector']); nt.links.new(nz.outputs['Fac'], cr.inputs[0])
    nt.links.new(cr.outputs[0], nt.nodes['Principled BSDF'].inputs['Roughness'])
    fl = plane('floor', 8.7, 5.6, fm, (0.05, 1.2, 0), index=IDX['env'])
    for lp in fl.data.uv_layers.active.data: lp.uv = (lp.uv.x*8.7/tile_m, lp.uv.y*5.6/tile_m)
    box('slab', (8.7, 5.6, 0.5), (0.05, 1.2, -0.251), srgb('slab', (12, 20, 28), rough=0.8), index=IDX['env'])
    box('edgeF', (8.7, 0.02, 0.02), (0.05, -1.6, -0.03), emit_mat('slabedge', (90, 170, 180), 0.6), index=IDX['env'])
    wm = srgb('wall', wall, rough=0.92); tm = srgb('trim', trim, rough=0.7)
    box('backwall', (8.7, 0.3, 2.4), (0.05, 4.15, 1.2), wm, index=IDX['env']); box('skirting', (8.7, 0.32, 0.08), (0.05, 4.0, 0.04), tm, index=IDX['env'])
    box('leftwall', (0.3, 5.9, 2.4), (-4.25, 1.25, 1.2), wm, index=IDX['env']); box('skirtingL', (0.32, 5.9, 0.08), (-4.1, 1.25, 0.04), tm, index=IDX['env'])
    return wm, tm

def door(x=-0.5, accent=(232, 86, 168), sign='exitH1'):
    dm = srgb('doorframe', (16, 22, 30), rough=0.4)
    box('doorL', (0.08, 0.2, 1.3), (x-0.45, 3.98, 0.65), dm); box('doorR', (0.08, 0.2, 1.3), (x+0.45, 3.98, 0.65), dm); box('doorT', (0.98, 0.2, 0.08), (x, 3.98, 1.3), dm)
    plane('doorvoid', 0.82, 1.26, srgb('doorvoid', (4, 8, 14)), (x, 3.995, 0.63), rot=(R(90), 0, 0))
    ei = bpy.data.images.load(TX+sign+'.png', check_existing=True)
    plane('exitsign', 0.12*ei.size[0]/ei.size[1], 0.12, img_mat('exit', TX+sign+'.png', emit=1.6), (x, 3.86, 1.42), rot=(R(90), 0, 0))
    light('AREA', (x, 3.6, 1.35), 3.0, tuple(c/255 for c in accent), 0.5, rot=(R(90), 0, 0))   # the one neon accent: soft

def monitor(x, y, rz=0, tex='monC_chat', z=0.38, emit=0.7):
    r = prop('computerScreen', x, y, rz, z=z)
    p = plane('screen', 0.32, 0.19, img_mat('scr_'+tex, TX+tex+'.png', emit=emit, rough=0.2), (0, 0, 0), rot=(R(90), 0, 0)); p.parent = r; p.location = (0.195, 0.035, 0.17)
    return r

def lamp_glow(x, y, z, energy=10, col=(1.0, 0.72, 0.45)):
    return light('POINT', (x, y, z), energy, col, 0.12)

# ---------------- actors ----------------
ACTORS = []   # objects that receive the actor rig (and are excluded from room lights)
def add_actor_objs(root):
    for o in [root] + list(root.children_recursive):
        if o.type in ('MESH', 'CURVE'): ACTORS.append(o)
def facing(dirn, allowed):
    """snap a desired 8-way screen direction to the nearest allowed sprite row (4-dir / 1-dir enemies)"""
    if dirn in allowed: return dirn
    order = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW']; i = order.index(dirn)
    for dd in (1, -1, 2, -2, 3, -3, 4):
        c = order[(i+dd) % 8]
        if c in allowed: return c
    return allowed[0]
ACTOR_LOG = []
def place_noor(x, y, dirn='S', action='idle', frame=10):
    ACTOR_LOG.append(dict(name='noor', x=x, y=y, dir=dirn))
    root, arm, meshes = build_noor()
    set_action(arm, action, frame); root.location = (x, y, 0); root.rotation_euler = (0, 0, R(SCR_RZ + ROT[dirn]))
    for o in root.children_recursive:
        if o.type in ('MESH', 'CURVE'): o.pass_index = 1
    add_actor_objs(root); return root
def place_enemy(name, x, y, dirn='S', anim='idle', k=0, z=0.0):
    E = BUILD[name](); d = facing(dirn, DIRS_FOR[name]); ACTOR_LOG.append(dict(name=name, x=x, y=y, dir=d))
    E['root'].location = (x, y, z); E['root'].rotation_euler = (0, 0, R(SCR_RZ + ROT[d])); pose(E, anim, k)
    add_actor_objs(E['root']); return E

def finish_lighting():
    """actor rig (light-linked to actors only) + exclude actors from every room light"""
    rc = bpy.data.collections.new('actors_recv'); ex = bpy.data.collections.new('actors_excl')
    for o in ACTORS: rc.objects.link(o); ex.objects.link(o)
    sc.collection.children.link(rc); sc.collection.children.link(ex)
    for co in ex.collection_objects: co.light_linking.link_state = 'EXCLUDE'
    for l in ROOM_LIGHTS: l.light_linking.receiver_collection = ex
    actor_rig(sc, cam_zrot_deg=-CAM_YAW, receivers=rc)

def world(strength=1.0):
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (*WORLD, 1); bg.inputs[1].default_value = strength

def base_lights(amb=(0.30, 0.45, 0.60), amb_e=55):
    light('AREA', (0.4, 1.3, 3.6), amb_e, amb, 8.5)                                   # broad, soft teal-indigo ambient
    s = light('SUN', (0, 0, 5), 0.45, (0.45, 0.75, 0.85), 6, rot=(R(-52), 0, R(165))); s.data.cycles.cast_shadow = False   # soft teal back-rim on the set
    k = light('AREA', (3.2, -2.4, 3.6), 70, (1.0, 0.82, 0.62), 3.0); aim(k, (-0.4, 1.6, 0))      # gentle warm key on the set (low)

# ================= FLOOR 2: OPEN PLAN (combat, calm) =================
def floor2():
    shell(wall=(40, 62, 76), trim=(26, 40, 50)); door(-0.2); world()
    rule_tiles(['DOOR', 'IS', 'SHUT'], -1.35, 2.75)
    # left-wall cluster: two desk pods facing into the room, one warm pendant over them
    for i, yy in enumerate((1.55, 2.45)):
        prop('desk', -3.75, yy+0.36, -90); monitor(-3.57, yy+0.19, -90, tex='monC_chat' if i else 'monA_chart'); prop('chairDesk', -3.25, yy+0.0, 90 + (10 if i else -8))
    prop('plantSmall2', -3.75, 3.2, 0, z=0.0, s=1.6); prop('pottedPlant', -3.95, 3.55, 0)
    pendant(-3.45, 2.1, 1.85, energy=160)
    # back-right cluster: low archive shelves (books only) + one plant
    for xx in (2.05, 2.85, 3.6):
        prop('bookcaseClosedWide', xx, 3.72, 0); books_row(xx, 3.72, (0.03, 0.40))
    prop('pottedPlant', 1.65, 3.78, 0)
    # right-edge cluster: coffee point (counter + machine) and a warm floor lamp
    for yy in (1.35, 0.92): prop('kitchenBar', 3.98, yy, 90)
    prop('kitchenCoffeeMachine', 3.9, 1.15, 90, z=0.42); lamp_glow(3.72, 1.15, 0.72, 8)
    prop('lampRoundFloor', 3.9, 2.05, 0); lamp_glow(3.95, 2.1, 0.95, 12)
    prop('pottedPlant', -3.6, -1.85, 0, s=1.8)          # one dark foreground framing element
    base_lights(amb_e=70)
    light('SPOT', (-0.3, 0.9, 3.4), 1300, (1.0, 0.72, 0.46), 0.6, spot=46, blend=0.75)    # big soft warm pool on the play area
    light('SPOT', (3.5, 1.4, 2.8), 90, (1.0, 0.74, 0.50), 0.4, spot=45, blend=1.0)
    light('SPOT', (2.2, 3.2, 2.8), 70, (0.55, 0.80, 0.90), 0.4, spot=55, blend=1.0)     # cool wash on the shelves
    place_noor(-0.5, 0.5, 'S', 'idle', 10)
    place_enemy('caret', -1.15, 0.2, 'S', 'idle', 0)
    place_enemy('warden', 1.15, 2.15, 'SW', 'idle', 0)
    place_enemy('hallucinator', -2.25, 0.95, 'SE', 'idle', 0)
    place_enemy('sycophant', 1.55, -0.05, 'S', 'idle', 0)
    rule_tiles(['REFUSE', 'ALL', 'VERBS'], 1.15, 2.15, h=0.15, z=1.40, floating=True, emit=0.9)

# ================= FLOOR 1: ARCHIVE (combat, calm) =================
def floor1():
    shell(wall=(36, 54, 74), trim=(24, 36, 50)); door(-0.2, accent=(110, 200, 220)); world()
    # back wall: one continuous run of shelves = calm rhythmic backdrop (door gap at x=-0.2)
    for xx in (-3.65, -2.8, -1.95, -1.1, 0.65, 1.5, 2.35, 3.2):
        prop('bookcaseClosedWide', xx, 3.72, 0); prop('bookcaseClosedWide', xx, 3.72, 0, z=0.79)
        books_row(xx, 3.72, (0.03, 0.40, 0.82, 1.19))
    # left edge cluster: ONE double-sided aisle running towards the camera, warm pendant above
    for yy in (1.2, 2.05):
        for side in (0, 1):
            e = bpy.data.objects.new('aisle', None); sc.collection.objects.link(e)
            e.location = (-3.6 + (0.02 if side else -0.02), yy, 0); e.rotation_euler = (0, 0, R(90 if side else -90))
            prop('bookcaseClosedWide', -0.42, -0.2, 0, parent=e); prop('bookcaseClosedWide', -0.42, -0.2, 0, z=0.79, parent=e)
            books_row(-0.42, -0.2, (0.03, 0.40, 0.82, 1.19), parent=e)
    pendant(-2.9, 1.65, 2.0, energy=160)
    # right edge cluster: reading desk + warm lamp, filing cabinets, library steps
    prop('desk', 3.62, 1.85, 90); monitor(3.8, 2.0, 90, tex='monC_chat'); prop('lampSquareTable', 3.85, 1.6, 0, z=0.38); lamp_glow(3.88, 1.62, 0.75, 9)
    prop('chairDesk', 3.25, 2.02, -90)
    for yy in (0.95, 0.52): prop('kitchenCabinetDrawer', 3.98, yy, 90)
    prop('stairsOpen', 3.9, 3.15, 90, s=0.75)
    prop('pottedPlant', 3.75, -1.8, 0, s=1.8)
    base_lights(amb=(0.28, 0.42, 0.62), amb_e=70)
    light('SPOT', (-0.4, 0.9, 3.4), 1300, (1.0, 0.72, 0.46), 0.6, spot=46, blend=0.75)
    light('SPOT', (3.4, 1.8, 2.8), 70, (1.0, 0.74, 0.5), 0.4, spot=45, blend=1.0)
    # Fern: present but quiet on her projector at the back-right, clear of the rule tiles
    build_fern(1.75, 2.85, 1.8, rz=SCR_RZ)
    rule_tiles(['NOTHING', 'IS', 'DELETED'], -1.0, 2.5)
    place_noor(-0.55, 0.55, 'S', 'idle', 10)
    place_enemy('caret', -1.25, 0.05, 'S', 'idle', 2)
    place_enemy('autocomplete', -2.25, 0.85, 'SE', 'idle', 0)
    place_enemy('redactor', 1.55, 0.6, 'SW', 'idle', 0)

# ================= FLOOR 2 BREAK ROOM: quiet exploration, no combat =================
def floor3():
    shell(floor_tex='floor_wood.png', wall=(44, 70, 80), trim=(28, 44, 52), tile_m=2.0); world()
    # back wall: a big night window (calm focal point)
    WX, WZ, WW, WH = 1.25, 1.05, 1.9, 1.15
    plane('sky', WW, WH, img_mat('sky', TX5+'window_sky.png', emit=1.1), (WX, 3.995, WZ), rot=(R(90), 0, 0), index=IDX['env'])
    fr = srgb('winframe', (18, 30, 38), rough=0.5)
    for dx in (-WW/2, -WW/6, WW/6, WW/2): box('mull', (0.05, 0.06, WH+0.05), (WX+dx, 3.97, WZ), fr, index=IDX['env'])
    for dz in (-WH/2, WH/2): box('rail', (WW+0.05, 0.06, 0.05), (WX, 3.97, WZ+dz), fr, index=IDX['env'])
    box('sill', (WW+0.2, 0.16, 0.04), (WX, 3.92, WZ-WH/2-0.03), srgb('sill', (60, 80, 88), rough=0.6), index=IDX['env'])
    light('AREA', (1.25, 3.6, 0.9), 30, (0.45, 0.65, 0.85), 1.8, rot=(R(90), 0, 0))
    # back-left cluster: kitchenette counter + fridge + microwave + coffee, warm under-light
    for xx in (-2.3, -1.87, -1.44): prop('kitchenCabinetDrawer', xx, 3.72, 0)
    prop('kitchenFridge', -1.0, 3.72, 0); prop('kitchenMicrowave', -2.25, 3.75, 0, z=0.45); prop('kitchenCoffeeMachine', -1.7, 3.78, 0, z=0.45)
    light('AREA', (-1.8, 3.4, 1.3), 30, (1.0, 0.74, 0.50), 1.4, rot=(R(30), 0, 0))
    door(3.2, accent=(110, 200, 220))                       # the way on (soft cyan accent)
    # left cluster: sofa nook on a round rug with a floor lamp and a plant
    prop('rugRound', -3.25, 1.05, 0, s=1.5)
    prop('loungeSofa', -3.75, 0.75, 90); prop('tableCoffee', -2.75, 1.25, 90); prop('lampRoundFloor', -3.9, 1.95, 0); lamp_glow(-3.9, 2.0, 0.95, 18)
    prop('pottedPlant', -3.95, -0.15, 0); prop('books', -2.85, 1.2, 20, z=0.23, s=1.4)
    prop('bench', 3.95, 2.1, 90); prop('plantSmall1', 3.95, 2.85, 0, s=1.5)
    prop('tableRound', 3.1, 0.15, 0); prop('chair', 3.1, 0.75, 180); prop('chair', 3.65, 0.05, 90)
    prop('lampRoundFloor', 3.75, 0.75, 0)
    light('POINT', (3.75, 0.75, 1.25), 60, (1.0, 0.72, 0.46), 0.12)
    light('SPOT', (3.2, 0.3, 3.0), 700, (1.0, 0.72, 0.46), 0.5, spot=40, blend=0.8)
    prop('pottedPlant', 3.7, -1.8, 0, s=1.8)          # foreground framing
    base_lights(amb=(0.32, 0.46, 0.58), amb_e=60)
    light('SPOT', (-3.1, 1.25, 2.6), 380, (1.0, 0.72, 0.46), 0.5, spot=55, blend=0.8)     # warm pool on the nook
    light('SPOT', (0.7, 1.2, 3.4), 1100, (1.0, 0.72, 0.46), 0.6, spot=46, blend=0.75)     # soft pool on the open floor
    # the unsent Draft pickup: a folded letter floating over a soft warm ring
    PX, PY = 1.55, 1.7
    pk = bpy.data.objects.new('draft', None); sc.collection.objects.link(pk); pk.location = (PX, PY, 0.42); pk.rotation_euler = (R(62), 0, R(SCR_RZ - 8))
    lm = img_mat('letter', TX5+'draft_letter.png', emit=0.18, rough=0.7)
    bpy.ops.mesh.primitive_plane_add(size=1); lt = bpy.context.object; lt.scale = (0.30, 0.21, 1); lt.parent = pk; lt.data.materials.append(lm); lt.pass_index = IDX['pickup']
    bpy.ops.mesh.primitive_torus_add(major_radius=0.24, minor_radius=0.008, major_segments=64, minor_segments=6, location=(PX, PY, 0.01))
    rg = bpy.context.object; rg.scale.z = 0.3; rg.data.materials.append(emit_mat('pkring', (255, 200, 140), 2.2)); rg.pass_index = IDX['pickup']
    light('POINT', (PX, PY-0.15, 0.55), 10, (1.0, 0.8, 0.55), 0.15)
    place_noor(0.0, 0.6, 'S', 'walk', 4)
    place_enemy('caret', -0.95, 0.15, 'S', 'idle', 0)

# ================= cast plates (transparent, actor rig only) =================
def cast(mode):
    world()
    if mode == 'castN':
        for k, rz in enumerate((0, 90, 180)):
            root, arm, meshes = build_noor(); set_action(arm, 'idle', 6); root.location = (-0.95 + k*0.95, 0, 0); root.rotation_euler = (0, 0, R(rz))
        tgt = (0.0, 0, 0.36); ortho = 2.9
    elif mode == 'castF':
        build_fern(0.0, 0, 2.0, rz=0); tgt = (0.0, 0, 0.95); ortho = 4.2   # front only (side view shows the halo edge-on)
    else:
        X = [-3.45, -2.2, -0.95, 0.5, 2.0, 3.45]
        for nm, x in zip(['caret', 'autocomplete', 'sycophant', 'warden', 'hallucinator', 'redactor'], X):
            E = BUILD[nm](); E['root'].location = (x, 0, 0); pose(E, 'idle', 0)
        tgt = (0.0, 0, 0.6); ortho = 8.4
    actor_rig(sc)
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = ortho; cd.clip_end = 100
    cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
    t = R(90-24); cam.rotation_euler = (t, 0, 0); d = Vector((0, math.sin(t), -math.cos(t))); cam.location = Vector(tgt) - d*20

def camera(cx, cy, ortho, pitch=38, yaw=-30):
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = ortho; cd.clip_end = 100
    cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
    t = R(90-pitch); yw = R(yaw); dirv = Vector((math.sin(yw)*math.sin(t), math.cos(yw)*math.sin(t), -math.cos(t)))
    cam.location = Vector((cx, cy, 0.5)) - dirv*20; cam.rotation_euler = (t, 0, -yw)

def render_setup():
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
    try: sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception: pass
    sc.cycles.max_bounces = 4; sc.cycles.diffuse_bounces = 2; sc.cycles.glossy_bounces = 2; sc.cycles.transparent_max_bounces = 24
    sc.render.resolution_x = W; sc.render.resolution_y = H; sc.render.resolution_percentage = 100
    sc.render.film_transparent = (not ROOM) or MODE.startswith('Rprop')
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
    vl = sc.view_layers[0]; vl.use_pass_mist = True; vl.use_pass_object_index = True
    if sc.world: sc.world.mist_settings.start = 14; sc.world.mist_settings.depth = 14
    sc.use_nodes = True; nt = sc.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    rl = nt.nodes.new('CompositorNodeRLayers'); comp = nt.nodes.new('CompositorNodeComposite'); nt.links.new(rl.outputs['Image'], comp.inputs['Image'])
    fo = nt.nodes.new('CompositorNodeOutputFile'); fo.base_path = OUT; fo.format.file_format = 'PNG'; fo.format.color_mode = 'BW'; fo.format.color_depth = '16'
    SUF = 'C' if os.environ.get('NOTILES') else ''
    fo.file_slots[0].path = MODE+SUF+'_mist_'; fo.file_slots.new(MODE+SUF+'_index_')
    nt.links.new(rl.outputs['Mist'], fo.inputs[0])
    dv = nt.nodes.new('CompositorNodeMath'); dv.operation = 'DIVIDE'; dv.inputs[1].default_value = 255.0
    nt.links.new(rl.outputs['IndexOB'], dv.inputs[0]); nt.links.new(dv.outputs[0], fo.inputs[1])
    sc.render.filepath = os.path.join(OUT, MODE+'.png')
    if os.environ.get('NOTILES'): sc.render.filepath = os.path.join(OUT, MODE+'_clean.png')

EXTRA_LOG = {}

exec(open(T5+'rooms6.py').read())
exec(open(T5+'rooms7.py').read())
exec(open(T5+'rooms8.py').read())
if MODE.startswith('R9_'): exec(open(T5+'office9.py').read())
if MODE.startswith('R7_'): CAM_T = (unproj(640, 360, 0.5).x, unproj(640, 360, 0.5).y)
if ROOM:
    if MODE in ROOMS6: ROOMS6[MODE]()
    else: {1: floor1, 2: floor2, 3: floor3}[FLOOR]()
    tune_props(); finish_lighting()
    if MODE.startswith('R9_'): camera9()
    else: camera(CAM_T[0], CAM_T[1], globals().get('CAM_O', 8.4))
else:
    cast(MODE)
render_setup()
import json
json.dump(dict(actors=ACTOR_LOG, cam_target=list(CAM_T), extra=EXTRA_LOG), open(os.path.join(OUT, MODE+'_actors.json'), 'w'), indent=1)
if BRIDGE.get('deck'):                      # plates never contain the bridge; it is rendered as its own frames below
    for o in BRIDGE['deck']: o.hide_render = True
FGHIDE = [f['idx'] for f in EXTRA_LOG.get('fg', []) if f['name'] in os.environ.get('FGHIDE', '').split(',')]
HID = [o for o in sc.objects if o.type in ('MESH', 'CURVE') and o.pass_index in FGHIDE and not o.hide_render]
for o in HID: o.hide_render = True          # toggled layers (hub door panel) live only in their fg overlay
AMBOBJ = [o for a in AMB for o in a['objs']]
for o in AMBOBJ: o.hide_render = True       # art-v8: ambient loops + lost lines live only in their own frames
bpy.ops.render.render(write_still=True)
for o in HID: o.hide_render = False
def iso_render(keep, path, spp):
    keep = set(keep); sc.use_nodes = False; sc.render.film_transparent = True; sc.cycles.samples = spp
    for o in sc.objects:
        if o.type in ('MESH', 'CURVE'): o.is_holdout = o not in keep
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)
    for o in sc.objects:
        if o.type in ('MESH', 'CURVE'): o.is_holdout = False
if os.environ.get('FGPASS'):                 # anti-aliased foreground layers: each group alone, everything else as holdout
    for f in EXTRA_LOG.get('fg', []):
        keep = [o for o in sc.objects if o.type in ('MESH', 'CURVE') and o.pass_index == f['idx'] and not o.hide_render]
        iso_render(keep, os.path.join(OUT, MODE + '_fg_' + f['name'] + '.png'), max(16, SAMPLES//2))
if os.environ.get('BRIDGEANIM') and BRIDGE.get('deck'):
    for o in BRIDGE['deck']: o.hide_render = False
    N = int(os.environ.get('BRIDGEANIM'))
    for k in range(N):
        ang = 90*(1 - k/(N - 1))**1.0; bridge_pose(ang)
        iso_render(BRIDGE['deck'] + BRIDGE['chain'], os.path.join(OUT, 'R7_bridge_%02d.png' % k), max(16, SAMPLES//2))
if os.environ.get('AMBPASS'):                 # art-v8 ambient loops: each frame alone, cropped render border for speed
    from bpy_extras.object_utils import world_to_camera_view
    cam = sc.camera
    for a in AMB:
        if os.environ.get('AMBONLY') and a['name'] not in os.environ['AMBONLY'].split(','): continue
        xs, ys = [], []
        for k in range(a['frames']):
            for o in a['objs']: o.hide_render = False
            if a['pose']: a['pose'](k)
            bpy.context.view_layer.update()
            for o in a['objs']:
                if o.hide_render: continue
                for c in o.bound_box:
                    v = world_to_camera_view(sc, cam, o.matrix_world @ Vector(c)); xs.append(v.x); ys.append(v.y)
        if not xs: continue
        pad = 10/1280
        sc.render.use_border = True; sc.render.use_crop_to_border = False
        sc.render.border_min_x = max(0, min(xs) - pad); sc.render.border_max_x = min(1, max(xs) + pad)
        sc.render.border_min_y = max(0, min(ys) - pad*1.8); sc.render.border_max_y = min(1, max(ys) + pad*1.8)
        for k in range(a['frames']):
            for o in a['objs']: o.hide_render = False
            if a['pose']: a['pose'](k)
            bpy.context.view_layer.update()
            iso_render([o for o in a['objs'] if not o.hide_render], os.path.join(OUT, MODE + '_amb_%s_%02d.png' % (a['name'], k)), max(16, SAMPLES//2))
        for o in a['objs']: o.hide_render = True
        sc.render.use_border = False
if MODE.startswith('R9_'): passes9()
print('DONE', MODE)
