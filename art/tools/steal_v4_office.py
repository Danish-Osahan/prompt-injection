# Steal-qualities v4: TIDY door lock — realistically proportioned to the lift door.
# Single horizontal chain across the double-door seam + normal padlock + red status light.
# High-contrast metal rim against dark door. NOT oversized. Exec from scene7 when STEALV4=1.
# usage: SKIPMAIN=1 NOTILES=1 STEALV4=1 STEALSPP=20 blender -b --python scene7.py -- R7_office ../render/steal_v4 1280 720 24
import math, os, json
from mathutils import Vector
OUT_V4 = OUT
os.makedirs(OUT_V4, exist_ok=True)
R = math.radians
SPP = int(os.environ.get('STEALSPP', str(max(16, SAMPLES // 2))))

# Brighter rim metal so links read on dark door without being huge
chain_m = srgb('v4_chain', (148, 156, 168), rough=0.28, metal=0.9)
chain_dark = srgb('v4_chaind', (88, 94, 104), rough=0.4, metal=0.75)
pad_m = srgb('v4_pad', (42, 44, 50), rough=0.45, metal=0.7)
shack_m = srgb('v4_shack', (160, 168, 180), rough=0.25, metal=0.95)
led_m = emit_mat('v4_led', (255, 56, 48), 4.0)
panel_m = srgb('v4_panel', (32, 34, 40), rough=0.6)

def link(loc, rot, bright=True, scale=1.0):
    # SMALL links — door is ~1.1m wide on wall; links ~4cm major
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.028 * scale, minor_radius=0.009 * scale,
        major_segments=9, minor_segments=5,
        location=loc, rotation=rot)
    o = bpy.context.object
    for p in o.data.polygons: p.use_smooth = False
    o.data.materials.append(chain_m if bright else chain_dark)
    return o

def pt(sx, sy):
    q = unproj(sx, 200)
    z = 0.18 + (200 - sy) / 120.0 * 0.95
    return Vector((q.x, q.y, z))

def build_lock(snap_u=0.0, bounce=0.0):
    """Neat single chain across door seam + padlock + wall LED.
    Links sit IN FRONT of the lift door (away()*eps), bright rim metal."""
    objs = []
    nrm = away(205, 200)

    def pt_front(sx, sy, eps=0.045):
        q = unproj(sx, 200)
        z = 0.22 + (200 - sy) / 120.0 * 0.9
        p = Vector((q.x, q.y, z)) - nrm * eps
        return p

    # horizontal chain of 5 links across seam at handle height
    n = 5
    sx0, sx1, sy = 182, 228, 150
    for i in range(n):
        t = i / (n - 1)
        sx = sx0 + (sx1 - sx0) * t
        p = pt_front(sx, sy)
        if i % 2 == 0:
            rot = (R(90), 0, R(SCR_RZ))
        else:
            rot = (0, R(90), R(SCR_RZ))
        if snap_u > 0:
            side = -1 if i < n/2 else (1 if i > n/2 else 0)
            fly = snap_u * (0.07 + 0.035 * abs(i - 2))
            p = p + Vector((side * fly * 0.6, 0.03 * fly,
                            -0.55 * snap_u * snap_u - 0.05 * abs(i-2) * snap_u
                            + bounce * abs(math.sin(snap_u * math.pi + i)) * 0.1))
            rot = (rot[0] + R(snap_u * 55 * (side or 1)), rot[1] + R(snap_u * 35 * i), rot[2] + R(snap_u * 70 * i))
        # slightly larger than first attempt but still << door
        objs.append(link(tuple(p), rot, bright=(i % 2 == 0), scale=1.25))

    # two short vertical links through center (reads as locked through handles)
    if snap_u < 0.55:
        for dsy in (-9, 9):
            p = pt_front(205, sy + dsy)
            rot = (R(90), 0, R(SCR_RZ + 90))
            if snap_u > 0:
                p = p + Vector((0.03 * snap_u, 0, -0.25 * snap_u))
            objs.append(link(tuple(p), rot, bright=False, scale=1.1))

    # thin bright crossbar (handle bar) behind chain — strong silhouette cue
    if snap_u < 0.35:
        A = unproj(188, 200); B = unproj(222, 200)
        c = (A + B) / 2 - nrm * 0.038
        c.z = pt_front(205, 150).z
        bar = box('v4_bar', ((B - A).length * 0.95, 0.012, 0.016), (c.x, c.y, c.z), shack_m,
                  rot=(0, 0, math.atan2((B - A).y, (B - A).x)))
        objs.append(bar)

    # padlock — normal size, bright shackle rim
    pc = pt_front(205, 160, eps=0.05)
    if snap_u > 0.4:
        drop = max(0.0, (snap_u - 0.4) / 0.6)
        pc = pc + Vector((0.05 * drop, 0.02 * drop,
                          -0.7 * drop * drop + bounce * 0.08 * max(0, 1 - drop)))
        pad_rot = (R(drop * 55), R(drop * 30), R(SCR_RZ + drop * 80))
    else:
        pad_rot = (0, 0, R(SCR_RZ)); drop = 0.0

    body = box('v4_pad', (0.052, 0.03, 0.045), (pc.x, pc.y, pc.z), pad_m, rot=pad_rot)
    objs.append(body)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.024, minor_radius=0.006, major_segments=10, minor_segments=5,
        location=(pc.x, pc.y, pc.z + 0.03), rotation=(R(90), 0, pad_rot[2]))
    sh = bpy.context.object; sh.scale = (0.72, 1.0, 0.85)
    for poly in sh.data.polygons: poly.use_smooth = False
    sh.data.materials.append(shack_m); objs.append(sh)
    # bright rim plane edge on pad body (fake highlight strip)
    rim = box('v4_rim', (0.054, 0.004, 0.01), (pc.x, pc.y + 0.016, pc.z + 0.012), shack_m, rot=pad_rot)
    objs.append(rim)

    # red lock light by keypad
    if snap_u < 0.85:
        led_panel = on_wall(262, 272, 128, 148, 200, panel_m, eps=0.03, name='v4_ledpanel')
        objs.append(led_panel)
        lp = Vector(pt_front(267, 138, eps=0.05))
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.012, location=lp)
        led = bpy.context.object
        for poly in led.data.polygons: poly.use_smooth = False
        led.data.materials.append(led_m); objs.append(led)
        ld = L_at('POINT', 267, 200, 0.55, 4.0, (1.0, 0.15, 0.08), size=0.05)
        objs.append(ld)

    return objs

def wipe(objs):
    for o in objs:
        try: bpy.data.objects.remove(o, do_unlink=True)
        except Exception: pass

def border_door():
    sc.render.use_border = True; sc.render.use_crop_to_border = False
    # tighter crop around door — lock is small
    sc.render.border_min_x = 130/1280; sc.render.border_max_x = 300/1280
    sc.render.border_min_y = 1 - 360/720; sc.render.border_max_y = 1 - 70/720

sc.cycles.samples = SPP
sc.cycles.use_denoising = True
sc.render.film_transparent = False

meta = {'door': []}
print('STEALV4 door lock…')
border_door()

# hang (subtle sway)
for k, sway in enumerate([0.0, 0.008, -0.006, 0.004]):
    objs = build_lock(snap_u=0.0, bounce=0.0)
    if sway and objs:
        objs[0].location = Vector(objs[0].location) + Vector((sway, 0, 0))
        if len(objs) > 4:
            objs[4].location = Vector(objs[4].location) + Vector((-sway, 0, 0))
    sc.render.filepath = os.path.join(OUT_V4, 'door_hang_%02d.png' % k)
    bpy.ops.render.render(write_still=True)
    meta['door'].append('door_hang_%02d.png' % k)
    wipe(objs)
    print('  hang', k)

# snap sequence
snap_curve = [0.0, 0.06, 0.14, 0.28, 0.42, 0.55, 0.68, 0.78, 0.88, 0.95, 1.0, 1.0]
for k, u in enumerate(snap_curve):
    bounce = 0.0
    if 0.35 < u < 0.95:
        bounce = math.sin((u - 0.35) / 0.6 * math.pi) * (1.0 - u) * 1.3
    objs = build_lock(snap_u=u, bounce=bounce)
    sc.render.filepath = os.path.join(OUT_V4, 'door_snap_%02d.png' % k)
    bpy.ops.render.render(write_still=True)
    meta['door'].append('door_snap_%02d.png' % k)
    wipe(objs)
    print('  snap', k, u)

sc.render.use_border = False
json.dump(meta, open(os.path.join(OUT_V4, 'meta_v4.json'), 'w'), indent=1)
print('STEALV4 DONE', OUT_V4)
