# Steal-qualities v3: in-scene chains + blinds on the clarity office (exec'd from scene7 when STEALV3=1).
# Same camera/lights/materials language as the plate. Renders border frames for door+window beats.
# usage via: SKIPMAIN=1 NOTILES=1 STEALV3=1 blender -b --python scene7.py -- R7_office ../render/steal_v3 1280 720 24
import math, os, json
from mathutils import Vector
OUT_V3 = OUT  # scene7 OUT
os.makedirs(OUT_V3, exist_ok=True)
R = math.radians
SPP = int(os.environ.get('STEALSPP', str(max(16, SAMPLES // 2))))

# ---- materials matching office (flat, matte-metal lift language) ----
chain_m = srgb('steal_chain', (72, 80, 90), rough=0.45, metal=0.75)
pad_m = srgb('steal_pad', (36, 38, 44), rough=0.55, metal=0.6)
shack_m = srgb('steal_shack', (90, 96, 104), rough=0.35, metal=0.8)
led_m = emit_mat('steal_led', (220, 48, 40), 2.8)
blind_m = srgb('steal_blind', (48, 56, 66), rough=0.7)
blind_hi = srgb('steal_blindhi', (62, 72, 84), rough=0.65)

def faceted_link(loc, rot, scale=(1,1,1)):
    """Low-poly chain link: torus with few segments, FLAT shaded (matches office)."""
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.055, minor_radius=0.018,
        major_segments=10, minor_segments=6,
        location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    # flat shade
    for p in o.data.polygons: p.use_smooth = False
    o.data.materials.append(chain_m)
    return o

def build_chains(snap_u=0.0, bounce=0.0):
    """2 crossed strands × ~6 big links + 1 padlock. snap_u 0=hanging, 1=fully apart."""
    objs = []
    # screen-space anchors on the lift (matches office11 door box ~150-260 x, 80-200 y)
    # place in world via unproj at mid-height of door
    # Strand A: top-left → bottom-right; Strand B: top-right → bottom-left
    def pt(sx, sy):
        # sy here is screen y of the link center; unproj at z from door height
        # door spans sy 80..200 at floor line 200 → use on_wall-ish depth
        # Approximate: use unproj on floor then lift z
        q = unproj(sx, 200)  # floor under door
        # height fraction from sill
        z = 0.15 + (200 - sy) / 120.0 * 0.95  # map sy 200→0.15, sy 80→~1.1
        return Vector((q.x, q.y, z))

    strands = [
        # (sx0,sy0) -> (sx1,sy1), n links
        ((165, 95), (240, 185), 6),
        ((245, 95), (170, 185), 6),
    ]
    link_objs = []
    for si, ((sx0, sy0), (sx1, sy1), n) in enumerate(strands):
        for i in range(n):
            t = i / (n - 1)
            sx = sx0 + (sx1 - sx0) * t
            sy = sy0 + (sy1 - sy0) * t
            p = pt(sx, sy)
            # alternate orientation for interlocking look
            ang = math.atan2(sy1 - sy0, sx1 - sx0)
            if i % 2 == 0:
                rot = (R(90), 0, ang + R(SCR_RZ))
            else:
                rot = (0, R(90), ang + R(SCR_RZ))
            # snap: fling along strand normal + gravity
            if snap_u > 0:
                # perpendicular in screen-ish xz
                nx = -(sy1 - sy0); ny = (sx1 - sx0)
                nl = math.hypot(nx, ny) or 1
                nx, ny = nx / nl, ny / nl
                side = 1 if si == 0 else -1
                fly = snap_u * (0.08 + 0.04 * i)
                p = p + Vector((nx * fly * side * 0.35, ny * fly * side * 0.15,
                                snap_u * snap_u * (-0.55 - 0.08 * i) + bounce * abs(math.sin(snap_u * math.pi + i)) * 0.12))
                rot = (rot[0] + R(snap_u * (40 + 15 * i) * side), rot[1] + R(snap_u * 25 * i), rot[2] + R(snap_u * 60 * i))
            o = faceted_link(tuple(p), rot, scale=(1.35, 1.35, 1.35))
            link_objs.append(o); objs.append(o)

    # padlock at crossing (~205, 140)
    pc = pt(205, 142)
    if snap_u > 0.35:
        # drop last — delayed
        drop = max(0.0, (snap_u - 0.35) / 0.65)
        pc = pc + Vector((0.05 * drop, 0.02 * drop, -0.7 * drop * drop + bounce * 0.08 * max(0, 1 - drop)))
        pad_rot = (R(drop * 70), R(drop * 40), R(SCR_RZ + drop * 90))
    else:
        pad_rot = (0, 0, R(SCR_RZ))
        drop = 0.0

    body = box('steal_padbody', (0.09, 0.05, 0.08), (pc.x, pc.y, pc.z), pad_m, rot=pad_rot)
    objs.append(body)
    # shackle (half torus)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.042, minor_radius=0.009, major_segments=12, minor_segments=6,
                                    location=(pc.x, pc.y, pc.z + 0.055), rotation=(R(90), 0, pad_rot[2]))
    sh = bpy.context.object; sh.scale = (0.75, 1.0, 0.85)
    for p in sh.data.polygons: p.use_smooth = False
    sh.data.materials.append(shack_m); objs.append(sh)
    # red lock LED (small flat-ish)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.014,
                                        location=(pc.x, pc.y + 0.028, pc.z - 0.01))
    led = bpy.context.object
    for p in led.data.polygons: p.use_smooth = False
    led.data.materials.append(led_m); objs.append(led)
    if snap_u <= 0.35:
        ld = L_at('POINT', 205, 200, pc.z, 4.5, (1.0, 0.2, 0.12), size=0.08)
        objs.append(ld)
    return objs, link_objs

def build_blinds(open_u=1.0):
    """Horizontal office blinds IN FRONT of the window glass (same on_wall language)."""
    objs = []
    sx0, sx1, syf = 775, 1145, 200
    A = unproj(sx0, syf); B = unproj(sx1, syf); d = B - A
    nrm = away(sx0, syf)
    yaw = math.atan2(d.y, d.x)
    n_slats = 8
    for i in range(n_slats):
        # sy from near top of window (78) to bottom (182)
        sy = 82 + i * ((182 - 82) / (n_slats - 1))
        z = zpx(syf - sy)
        # sit clearly in front of glass (window eps~0.012)
        eps = 0.055 + 0.02 * open_u
        c = (A + B) / 2 - nrm * eps
        c.z = z
        # shut: slats flat (cover); open: tilt so gaps show sky
        tilt = R(8 + 62 * open_u)
        thick = 0.028 if open_u < 0.25 else 0.022
        height = 0.055 if open_u < 0.25 else 0.042
        slat = box('blind%d' % i, (d.length * 0.94, thick, height), (c.x, c.y, c.z),
                   blind_m if i % 2 == 0 else blind_hi,
                   rot=(tilt, 0, yaw))
        objs.append(slat)
    # top rail (always)
    z_top = zpx(syf - 78)
    c = (A + B) / 2 - nrm * 0.05; c.z = z_top + 0.03
    objs.append(box('blindrail', (d.length * 0.96, 0.03, 0.03), (c.x, c.y, c.z), blind_hi, rot=(0, 0, yaw)))
    return objs

def border_door():
    sc.render.use_border = True; sc.render.use_crop_to_border = False
    sc.render.border_min_x = 100/1280; sc.render.border_max_x = 320/1280
    sc.render.border_min_y = 1 - 370/720; sc.render.border_max_y = 1 - 50/720

def border_win():
    sc.render.use_border = True; sc.render.use_crop_to_border = False
    sc.render.border_min_x = 740/1280; sc.render.border_max_x = 1180/1280
    sc.render.border_min_y = 1 - 220/720; sc.render.border_max_y = 1 - 55/720

def wipe(objs):
    for o in objs:
        try: bpy.data.objects.remove(o, do_unlink=True)
        except Exception: pass

# Hide default lift panels during chained states? Keep lift visible — chains overlay it.
# Optionally dim lift gap.

sc.cycles.samples = SPP
sc.cycles.use_denoising = True
sc.render.film_transparent = False  # we want opaque plate-matching beauty in border

meta = {'door': [], 'window': []}

# ---- WINDOW frames: open (blinds ajar) + slam shut ----
print('STEALV3 window…')
border_win()
for k, ou in enumerate([1.0, 0.85, 1.0, 0.7,  # open loop-ish
                        0.45, 0.2, 0.05, 0.0]):  # slam
    blinds = build_blinds(open_u=ou)
    sc.render.filepath = os.path.join(OUT_V3, 'win_%02d.png' % k)
    bpy.ops.render.render(write_still=True)
    meta['window'].append('win_%02d.png' % k)
    wipe(blinds)
    print('  win', k, 'open', ou)

# ---- DOOR frames: hang (4) + snap (12 with bounce) ----
print('STEALV3 door…')
border_door()
# hang
for k, sway in enumerate([0.0, 0.02, -0.015, 0.01]):
    # slight sway via snap_u=0 and tiny displacement baked as snap_u=0
    objs, _ = build_chains(snap_u=0.0, bounce=sway)
    # nudge first link slightly for sway
    if objs and sway:
        objs[0].location = Vector(objs[0].location) + Vector((sway * 2, 0, 0))
        objs[6].location = Vector(objs[6].location) + Vector((-sway * 2, 0, 0))
    sc.render.filepath = os.path.join(OUT_V3, 'door_hang_%02d.png' % k)
    bpy.ops.render.render(write_still=True)
    meta['door'].append('door_hang_%02d.png' % k)
    wipe(objs)
    print('  hang', k)

# snap: ease-out then bounce settle; padlock delayed
snap_curve = [0.0, 0.08, 0.18, 0.32, 0.48, 0.62, 0.74, 0.84, 0.92, 0.97, 1.0, 1.0]
for k, u in enumerate(snap_curve):
    # bounce peak around mid-late
    bounce = 0.0
    if 0.4 < u < 0.95:
        bounce = math.sin((u - 0.4) / 0.55 * math.pi) * (1.0 - u) * 1.4
    objs, _ = build_chains(snap_u=u, bounce=bounce)
    sc.render.filepath = os.path.join(OUT_V3, 'door_snap_%02d.png' % k)
    bpy.ops.render.render(write_still=True)
    meta['door'].append('door_snap_%02d.png' % k)
    wipe(objs)
    print('  snap', k, 'u', u)

sc.render.use_border = False
json.dump(meta, open(os.path.join(OUT_V3, 'meta_v3.json'), 'w'), indent=1)
print('STEALV3 DONE', OUT_V3)
