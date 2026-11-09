#!/usr/bin/env python3
"""mock-steal/v12 — whole throw→break beat as ONE Blender scene (no canvas paste).

Eevee, in-scene Noor + office set + chunky chain/padlock + wind + spark.
Break uses deterministic in-scene ballistic (3D keyed trajectories; live RB
chains were unstable). Hit-stop, flat sil frames from the same scene, punch cam.

Usage:
  blender -b --python art/tools/steal_beat_v12.py -- OUTDIR [SAMPLES] [MODE]
  MODE=full|preview|stills
"""
import bpy, sys, math, os, json, random
from mathutils import Vector, Euler, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:]
OUT = argv[0]
SAMPLES = int(argv[1]) if len(argv) > 1 else 24
MODE = argv[2] if len(argv) > 2 else 'full'
os.makedirs(OUT, exist_ok=True)
T = os.path.dirname(os.path.abspath(sys.argv[sys.argv.index('--python') + 1])) + '/'

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
R = math.radians
rng = random.Random(12)

FPS = 24
F_EST, F_ANTIC, F_RELEASE, F_CONTACT = 0, 6, 22, 34
F_HS0, F_HS1, F_SIL0, F_SIL1 = 35, 40, 41, 42
F_PUNCH, F_SETTLE, F_DOOR, F_END = 43, 64, 78, 110
sc.render.fps = FPS
sc.frame_start, sc.frame_end = 0, F_END

def wipe():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras,
                 bpy.data.lights, bpy.data.worlds, bpy.data.curves, bpy.data.armatures):
        for b in list(coll):
            coll.remove(b)

def mat_rgb(name, rgb, rough=0.45, metal=0.0, emit=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    c = (rgb[0]/255, rgb[1]/255, rgb[2]/255, 1)
    b.inputs['Base Color'].default_value = c
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit > 0:
        b.inputs['Emission Color'].default_value = c
        b.inputs['Emission Strength'].default_value = emit
    return m

def mat_emit(name, col, s=10.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Emission Color'].default_value = (*col, 1)
    b.inputs['Emission Strength'].default_value = s
    return m

def mat_flat(name, col, s=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*col, 1)
    em.inputs['Strength'].default_value = s
    nt.links.new(em.outputs[0], out.inputs[0])
    return m

def cube(name, scale, loc, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object; o.name = name; o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(mat)
    return o

def kloc(o, f, loc):
    o.location = loc; o.keyframe_insert('location', frame=f)

def krot(o, f, rot):
    o.rotation_euler = rot; o.keyframe_insert('rotation_euler', frame=f)

def khide(o, f, hide):
    o.hide_render = hide; o.keyframe_insert('hide_render', frame=f)

def ballistic(p0, v0, t, floor_z=0.03, rest=0.4):
    g = -9.8
    x, y, z = p0.x, p0.y, p0.z
    vx, vy, vz = v0.x, v0.y, v0.z
    dt = 1 / 24.0
    steps = max(1, int(t / dt)); rem = t - steps * dt
    for _ in range(steps):
        x += vx * dt; y += vy * dt
        z += vz * dt + 0.5 * g * dt * dt; vz += g * dt
        if z < floor_z:
            z = floor_z; vz = -vz * rest; vx *= 0.72; vy *= 0.72
            if abs(vz) < 0.4: vz = 0.0; break
    z += vz * rem + 0.5 * g * rem * rem
    return Vector((x, y, max(floor_z, z)))

# ---- set ----
def build_set():
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs[0].default_value = (0.02, 0.03, 0.05, 1); bg.inputs[1].default_value = 0.4

    wall = mat_rgb('wall', (52, 68, 84), 0.55)
    trim = mat_rgb('trim', (30, 40, 52), 0.4)
    floor = mat_rgb('floor', (58, 70, 86), 0.7)
    lift = mat_rgb('lift', (48, 54, 62), 0.35, metal=0.55)
    desk = mat_rgb('desk', (188, 192, 198), 0.4)
    plant = mat_rgb('plant', (42, 118, 90), 0.5)
    pot = mat_rgb('pot', (96, 74, 56), 0.5)
    handle = mat_rgb('handle', (200, 205, 210), 0.22, metal=1.0)

    cube('floor', (7, 6, 0.06), (0.5, 1.0, -0.03), floor)
    cube('wallB', (7, 0.16, 2.8), (0.5, 2.70, 1.35), wall)
    cube('wallL', (0.16, 4.0, 2.8), (-2.6, 1.0, 1.35), wall)

    # Door frame + leaves (centered near origin on back wall)
    cube('frameT', (1.2, 0.14, 0.08), (0.0, 2.62, 2.15), trim)
    cube('frameL', (0.08, 0.14, 2.05), (-0.58, 2.62, 1.05), trim)
    cube('frameR', (0.08, 0.14, 2.05), (0.58, 2.62, 1.05), trim)
    leafL = cube('leafL', (0.50, 0.07, 1.95), (-0.26, 2.60, 1.0), lift)
    leafR = cube('leafR', (0.50, 0.07, 1.95), (0.26, 2.60, 1.0), lift)
    hL = cube('handleL', (0.11, 0.045, 0.04), (-0.10, 2.55, 1.08), handle)
    hR = cube('handleR', (0.11, 0.045, 0.04), (0.10, 2.55, 1.08), handle)
    inside = cube('inside', (1.0, 0.05, 1.9), (0.0, 2.72, 1.0), mat_emit('in', (1.0, 0.9, 0.75), 2.5))
    khide(inside, 0, True)

    # Desk + plant (right)
    cube('desk', (1.2, 0.6, 0.06), (1.7, 1.2, 0.74), desk)
    for i, xy in enumerate([(1.25, 1.0), (2.15, 1.0), (1.25, 1.4), (2.15, 1.4)]):
        cube(f'dleg{i}', (0.05, 0.05, 0.37), (xy[0], xy[1], 0.37), desk)
    cube('pot', (0.13, 0.13, 0.15), (2.05, 1.25, 0.88), pot)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.24, location=(2.05, 1.25, 1.18))
    pl = bpy.context.object; pl.name = 'plant'; pl.data.materials.append(plant)

    def light(name, loc, e, col, size=1.8):
        ld = bpy.data.lights.new(name, 'AREA'); ld.energy = e; ld.color = col; ld.size = size
        o = bpy.data.objects.new(name, ld); o.location = loc; o.rotation_euler = (R(55), 0, R(-15))
        sc.collection.objects.link(o)
    light('key', (2.0, -0.8, 3.4), 500, (1, 0.95, 0.9), 2.4)
    light('fill', (-2.2, 0.8, 2.2), 140, (0.55, 0.72, 1.0), 3.0)
    light('rim', (0.2, 3.6, 2.6), 200, (0.7, 0.85, 1.0), 1.8)

    return dict(leafL=leafL, leafR=leafR, inside=inside, hL=hL, hR=hR)

def build_chain():
    metal = mat_rgb('chain', (170, 178, 190), 0.22, metal=1.0)
    dark = mat_rgb('pad', (40, 44, 52), 0.32, metal=0.9)
    ledm = mat_emit('led', (1.0, 0.15, 0.08), 35)

    links = []
    n = 7; span = 0.40
    y, z0 = 2.56, 1.08  # sit on handles
    for i in range(n):
        u = i / (n - 1)
        x = -span / 2 + u * span
        z = z0 + 0.03 * math.sin(u * math.pi)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.045, minor_radius=0.015,
                                        major_segments=28, minor_segments=12,
                                        location=(x, y, z))
        o = bpy.context.object; o.name = f'link_{i}'
        o.rotation_euler = (R(90 if i % 2 else 12), 0, R(90))
        o.data.materials.append(metal); bpy.ops.object.shade_smooth()
        links.append(o)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, y - 0.02, z0 - 0.18))
    body = bpy.context.object; body.name = 'pad_body'
    body.scale = (0.12, 0.08, 0.14); bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.modifier_add(type='BEVEL')
    body.modifiers['Bevel'].width = 0.01; body.modifiers['Bevel'].segments = 2
    bpy.ops.object.modifier_apply(modifier='Bevel')
    body.data.materials.append(dark); bpy.ops.object.shade_smooth()

    bpy.ops.mesh.primitive_torus_add(major_radius=0.07, minor_radius=0.014,
                                    major_segments=24, minor_segments=10,
                                    location=(0, y - 0.02, z0 - 0.02))
    sh = bpy.context.object; sh.name = 'pad_shackle'
    sh.rotation_euler = (R(90), 0, 0); bpy.ops.object.transform_apply(rotation=True)
    sh.data.materials.append(dark); bpy.ops.object.shade_smooth()

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.018, location=(0, y + 0.03, z0 - 0.15))
    led = bpy.context.object; led.name = 'pad_led'; led.data.materials.append(ledm)
    led.parent = body; led.location = (0, 0.045, 0.02)

    return dict(links=links, body=body, sh=sh, led=led,
                rests=[Vector(o.location) for o in links],
                body0=Vector(body.location), sh0=Vector(sh.location))

def build_wind():
    m = mat_emit('wind', (0.75, 0.92, 1.0), 4.0)
    try: m.blend_method = 'HASHED'
    except Exception: pass
    blobs = []
    for i in range(9):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=0.11,
                                            location=(0, 0, -4))
        o = bpy.context.object; o.name = f'wind_{i}'
        o.data.materials.append(m); bpy.ops.object.shade_smooth()
        o.scale = (0.7, 0.55, 1.5); khide(o, 0, True)
        blobs.append(o)
    return blobs

def build_spark():
    # Directional spike mesh
    verts = [(0, 0, 0)]; faces = []; vi = 1
    for ang, length, width in [(0, 0.55, 0.09), (0.5, 0.36, 0.06), (-0.45, 0.4, 0.06),
                                (2.9, 0.28, 0.05), (1.7, 0.22, 0.04)]:
        tip = Vector((math.cos(ang) * length, -0.01, math.sin(ang) * length * 0.75))
        base = tip * 0.1
        right = Vector((-math.sin(ang), 0, math.cos(ang))) * width
        up = Vector((0, width * 0.55, 0))
        for d in (right + up, -right + up, -right - up, right - up):
            verts.append(tuple(base + d))
        tip_i = len(verts); verts.append(tuple(tip))
        b0 = vi
        for k in range(4):
            faces.append((b0 + k, b0 + (k + 1) % 4, tip_i))
        vi = tip_i + 1
    mesh = bpy.data.meshes.new('spark'); mesh.from_pydata(verts, [], faces); mesh.update()
    spark = bpy.data.objects.new('spark', mesh); sc.collection.objects.link(spark)
    spark.data.materials.append(mat_emit('spk', (1, 0.97, 0.9), 28))
    spark.location = (0.0, 2.50, 1.08); spark.scale = (0.01, 0.01, 0.01); khide(spark, 0, True)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.07, location=spark.location)
    core = bpy.context.object; core.name = 'spark_core'
    core.data.materials.append(mat_emit('spkC', (1, 1, 1), 45))
    core.scale = (0.01, 0.01, 0.01); khide(core, 0, True)
    return spark, core

def load_noor():
    exec(open(T + 'noor.py').read(), globals())
    root, arm, meshes = build_noor()
    root.scale = (2.0, 2.0, 2.0)
    root.location = (0.85, 1.85, 0.0)  # closer to door so full body reads in cine
    root.rotation_euler = (0, 0, R(-48))
    bpy.context.view_layer.update()
    return root, arm

def anim_noor(arm):
    bones = {b.name: b for b in arm.pose.bones}
    def kb(name, f, eul=None, loc=None):
        pb = bones[name]; pb.rotation_mode = 'QUATERNION'
        if eul is not None:
            pb.rotation_quaternion = Euler((R(eul[0]), R(eul[1]), R(eul[2])), 'XYZ').to_quaternion()
            pb.keyframe_insert('rotation_quaternion', frame=f)
        if loc is not None:
            pb.location = loc; pb.keyframe_insert('location', frame=f)
    # rest
    for f in (0, F_ANTIC - 1):
        kb('torso', f, (0, 0, -8)); kb('arm-right', f, (-25, 15, 8))
        kb('arm-left', f, (-18, -12, -8)); kb('head', f, (4, 0, -12))
    # coil
    kb('torso', F_ANTIC + 8, (-8, 4, 26)); kb('arm-right', F_ANTIC + 8, (-105, 42, 50))
    kb('arm-left', F_ANTIC + 8, (-40, -22, 18)); kb('head', F_ANTIC + 8, (10, 0, 18))
    kb('root', F_ANTIC + 8, loc=Vector((0, 0, -0.02)))
    # release
    kb('torso', F_RELEASE + 2, (12, -2, -20)); kb('arm-right', F_RELEASE + 2, (22, -32, -68))
    kb('arm-left', F_RELEASE + 2, (-50, 28, -32)); kb('head', F_RELEASE + 2, (-5, 0, -26))
    # follow-through hold
    for f in (F_CONTACT, F_HS1, F_SIL1, F_PUNCH + 5):
        kb('torso', f, (18, -4, -30)); kb('arm-right', f, (42, -52, -82))
        kb('arm-left', f, (-58, 36, -40)); kb('head', f, (-8, 0, -30))
    # recover
    kb('torso', F_END - 6, (2, 0, -6)); kb('arm-right', F_END - 6, (-22, 12, 4))
    kb('arm-left', F_END - 6, (-18, -8, -6)); kb('head', F_END - 6, (0, 0, -8))
    kb('root', F_END - 6, loc=Vector((0, 0, 0)))

def anim_wind(blobs):
    p0, p1, p2 = Vector((0.55, 1.95, 1.25)), Vector((0.25, 2.20, 1.35)), Vector((0.0, 2.52, 1.08))
    def bez(u):
        a = p0.lerp(p1, u); b = p1.lerp(p2, u); return a.lerp(b, u)
    for f in range(F_RELEASE, F_CONTACT + 2):
        u = (f - F_RELEASE) / max(1, (F_CONTACT - F_RELEASE))
        for i, o in enumerate(blobs):
            v = max(0.0, u - 0.08 * i)
            kloc(o, f, bez(v)); khide(o, f, False)
            sca = (0.9 - i * 0.06) * (0.75 + 0.4 * (1 - v))
            o.scale = (0.7 * sca, 0.55 * sca, 1.55 * sca); o.keyframe_insert('scale', frame=f)
    for o in blobs:
        khide(o, F_CONTACT + 3, True)

def anim_spark(spark, core):
    khide(spark, F_CONTACT, False); khide(core, F_CONTACT, False)
    for f, s in [(F_CONTACT, 0.5), (F_HS0, 1.0), (F_HS0 + 2, 1.3), (F_HS1, 1.1),
                 (F_SIL0, 1.35), (F_SIL1, 1.2), (F_PUNCH + 2, 0.7), (F_PUNCH + 8, 0.15)]:
        spark.scale = (s, s, s); spark.keyframe_insert('scale', frame=f)
        core.scale = (s * 0.85,) * 3; core.keyframe_insert('scale', frame=f)
        spark.rotation_euler = (0, 0, R(f * 8)); spark.keyframe_insert('rotation_euler', frame=f)
    khide(spark, F_PUNCH + 10, True); khide(core, F_PUNCH + 10, True)

def anim_chain(chain):
    links, body, sh = chain['links'], chain['body'], chain['sh']
    rests, body0, sh0 = chain['rests'], chain['body0'], chain['sh0']
    for i, o in enumerate(links):
        for f in (0, F_ANTIC, F_RELEASE, F_CONTACT - 1, F_HS1, F_SIL1, F_PUNCH - 1):
            kloc(o, f, rests[i])
        # taut at contact
        kloc(o, F_CONTACT, rests[i] + Vector((0, -0.04, -0.015)))
    for f in (0, F_CONTACT, F_SIL1, F_PUNCH - 1):
        kloc(body, f, body0); kloc(sh, f, sh0)
    # shackle pop
    krot(sh, F_PUNCH - 1, Euler((0, 0, 0)))
    krot(sh, F_PUNCH + 2, Euler((R(-35), R(40), R(25))))
    krot(sh, F_PUNCH + 12, Euler((R(-10), R(110), R(70))))

    specs = []
    for i, o in enumerate(links):
        side = -1.0 if i < 3 else (0.1 if i == 3 else 1.0)
        v0 = Vector((side * (1.5 + 0.3 * abs(i - 3)), -0.55 - 0.12 * (i % 3),
                     2.9 + 0.4 * ((i % 5) - 2)))
        spin = Euler((R(45 + i * 22), R(-28 + i * 16), R(55 + i * 20)))
        specs.append((o, rests[i] + Vector((0, -0.04, 0)), v0, spin))
    specs.append((body, body0, Vector((1.35, -0.55, 3.1)), Euler((R(65), R(35), R(85)))))
    specs.append((sh, sh0, Vector((-1.15, -0.35, 3.7)), Euler((R(110), R(65), R(35)))))

    for fi in range(0, F_END - F_PUNCH + 1):
        f = F_PUNCH + fi; t = fi / 24.0
        for o, p0, v0, spin in specs:
            kloc(o, f, ballistic(p0, v0, t))
            krot(o, f, Euler((spin.x * (1 + t * 2.1), spin.y * (1 + t * 1.7), spin.z * (1 + t * 2.4))))

def anim_door(seto):
    for leaf, sign in ((seto['leafL'], -1), (seto['leafR'], 1)):
        base = Vector(leaf.location)
        kloc(leaf, F_CONTACT, base)
        kloc(leaf, F_PUNCH, base + Vector((sign * 0.025, -0.06, 0)))
        kloc(leaf, F_PUNCH + 4, base)
        kloc(leaf, F_DOOR, base)
        kloc(leaf, F_DOOR + 18, base + Vector((sign * 0.55, 0, 0)))
        kloc(leaf, F_END, base + Vector((sign * 0.55, 0, 0)))
    khide(seto['inside'], F_DOOR + 4, False)

def setup_cams():
    t = R(90 - 38)
    d = Vector((0, math.sin(t), -math.cos(t)))
    # Establishing (game-like)
    cd = bpy.data.cameras.new('cam_game'); cd.type = 'ORTHO'; cd.ortho_scale = 5.6
    cam_g = bpy.data.objects.new('cam_game', cd); sc.collection.objects.link(cam_g)
    cam_g.rotation_euler = (t, 0, R(10))
    tgt = Vector((0.55, 1.7, 0.95))
    cam_g.location = tgt - d * 14
    # Cinematic ~2x closer
    cd2 = bpy.data.cameras.new('cam_cine'); cd2.type = 'ORTHO'; cd2.ortho_scale = 4.2
    cam_c = bpy.data.objects.new('cam_cine', cd2); sc.collection.objects.link(cam_c)
    cam_c.rotation_euler = (t, 0, R(8))
    tgt2 = Vector((0.4, 2.05, 0.85))  # bias toward door+Noor mid
    cam_c.location = tgt2 - d * 12
    # punch
    base = cd2.ortho_scale
    for f, mul in [(F_ANTIC, 1), (F_SIL1, 1), (F_PUNCH, 0.86), (F_PUNCH + 5, 0.82),
                   (F_SETTLE, 0.94), (F_END, 1)]:
        cd2.ortho_scale = base * mul; cd2.keyframe_insert('ortho_scale', frame=f)
    base_loc = cam_c.location.copy()
    for f in range(F_PUNCH, F_PUNCH + 10):
        amp = 0.035 * math.exp(-(f - F_PUNCH) / 5)
        cam_c.location = base_loc + Vector((rng.uniform(-1, 1) * amp, rng.uniform(-1, 1) * amp * 0.4, 0))
        cam_c.keyframe_insert('location', frame=f)
    cam_c.location = base_loc; cam_c.keyframe_insert('location', frame=F_PUNCH + 12)
    sc.camera = cam_c
    return cam_g, cam_c

def setup_eevee(w=960, h=540):
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    ee = sc.eevee
    if hasattr(ee, 'use_bloom'):
        ee.use_bloom = True; ee.bloom_intensity = 0.1; ee.bloom_threshold = 0.65
    if hasattr(ee, 'use_motion_blur'):
        ee.use_motion_blur = True; ee.motion_blur_shutter = 0.45
    if hasattr(ee, 'taa_render_samples'):
        ee.taa_render_samples = max(16, SAMPLES)

# Flat sil from same scene
_mat_cache = {}
def set_sil(mode, chain):
    global _mat_cache
    if not _mat_cache:
        for o in bpy.data.objects:
            if o.type == 'MESH' and o.material_slots:
                _mat_cache[o.name] = [s.material for s in o.material_slots]
    if mode == 'restore':
        for name, mats in _mat_cache.items():
            o = bpy.data.objects.get(name)
            if not o: continue
            for i, m in enumerate(mats):
                if i < len(o.material_slots):
                    o.material_slots[i].material = m
        for o in bpy.data.objects:
            if o.type == 'MESH' and not o.name.startswith('wind_'):
                o.hide_render = False
        for nm in [f'wind_{i}' for i in range(9)]:
            o = bpy.data.objects.get(nm)
            if o: o.hide_render = True
        sc.world.node_tree.nodes['Background'].inputs[0].default_value = (0.02, 0.03, 0.05, 1)
        sc.world.node_tree.nodes['Background'].inputs[1].default_value = 0.4
        return
    black = mat_flat('SILB', (0.02, 0.025, 0.03))
    white = mat_flat('SILW', (0.98, 0.96, 0.92))
    bright = mat_flat('SILC', (1, 1, 1), 2.2)
    body = black if mode == 'bow' else white
    bg = (0.97, 0.93, 0.86, 1) if mode == 'bow' else (0.015, 0.02, 0.03, 1)
    sc.world.node_tree.nodes['Background'].inputs[0].default_value = bg
    sc.world.node_tree.nodes['Background'].inputs[1].default_value = 1.4 if mode == 'bow' else 0.25
    hide = {'floor', 'wallB', 'wallL', 'desk', 'pot', 'plant', 'frameT', 'frameL', 'frameR',
            'inside', 'dleg0', 'dleg1', 'dleg2', 'dleg3'}
    chain_names = {o.name for o in chain['links']} | {'pad_body', 'pad_shackle', 'pad_led', 'spark', 'spark_core'}
    for o in bpy.data.objects:
        if o.type != 'MESH': continue
        if o.name in hide or o.name.startswith('wind_'):
            o.hide_render = True; continue
        if o.name.startswith('linkP'): 
            o.hide_render = True; continue
        o.hide_render = False
        if not o.material_slots: continue
        use = bright if o.name in chain_names else body
        # Noor armature children
        if o.parent and o.parent.type == 'ARMATURE':
            use = body
        for i in range(len(o.material_slots)):
            o.material_slots[i].material = use

def render_path(path):
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)

def main():
    print('=== v12', OUT, SAMPLES, MODE, flush=True)
    wipe()
    seto = build_set()
    chain = build_chain()
    blobs = build_wind()
    spark, core = build_spark()
    root, arm = load_noor()
    cam_g, cam_c = setup_cams()
    setup_eevee()

    anim_noor(arm)
    anim_wind(blobs)
    anim_spark(spark, core)
    anim_chain(chain)
    anim_door(seto)

    blend = os.path.join(OUT, 'steal_beat_v12.blend')
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    print('saved', blend, flush=True)

    meta = dict(fps=FPS, end=F_END, samples=SAMPLES, res=[960, 540], engine='EEVEE_NEXT',
                marks=dict(antic=F_ANTIC, release=F_RELEASE, contact=F_CONTACT,
                           hitstop=[F_HS0, F_HS1], sil=[F_SIL0, F_SIL1], punch=F_PUNCH,
                           door=F_DOOR),
                note='In-scene ballistic break (keyed 3D). Live RB chains discarded as unstable.')
    with open(os.path.join(OUT, 'meta.json'), 'w') as f:
        json.dump(meta, f, indent=2)

    frames = os.path.join(OUT, 'frames'); os.makedirs(frames, exist_ok=True)
    want = None
    if MODE == 'preview':
        want = {0, F_ANTIC, F_RELEASE, F_CONTACT, F_HS0, F_SIL0, F_SIL1, F_PUNCH, F_PUNCH + 6, F_SETTLE, F_DOOR, F_END}
    elif MODE == 'stills':
        want = {0, F_CONTACT, F_SIL0, F_SIL1, F_PUNCH + 4, F_SETTLE + 4, F_DOOR + 12}

    for f in range(0, F_END + 1):
        if want is not None and f not in want: continue
        sc.frame_set(f)
        sc.camera = cam_g if f < F_ANTIC else cam_c
        if f == F_SIL0:
            set_sil('bow', chain)
        elif f == F_SIL1:
            set_sil('wob', chain)
        elif f > F_SIL1:
            set_sil('restore', chain)
        render_path(os.path.join(frames, f'f_{f:04d}.png'))
        if f % 12 == 0: print(f'  {f}/{F_END}', flush=True)
    set_sil('restore', chain)
    print('DONE', frames, flush=True)

if __name__ == '__main__':
    main()
