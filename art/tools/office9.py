# art-v9 OFFICE test level: a lower perspective 3/4 camera with real depth (exec'd by scene7.py for MODE R9_office).
# Same world layout as art-v7/8 (rooms7.P_office + rooms8.L_office, placed in the old ortho screen space via unproj),
# plus: a taller back wall, side walls, near-camera occluders (partition, pendants + cables, plant), a real floor-lamp light.
# The camera is a PERSPECTIVE camera (env ELEV deg, DIST units), fitted so the floor fills the central 1280x720 of a
# 1440x810 overscan render (the game's directing camera pans/zooms inside it).
# Writes EXTRA_LOG['view']: floor homography H (old logical floor px -> view px), sprite scale fit, anchors, layer info.
# passes9(): back/mid parallax layers, the near layer, swap variants (both layers), inspect close-ups.
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
TX9 = T5 + '../tex/'
VW, VH, OX, OY = 1440, 810, 80, 45
ELEV = float(os.environ.get('ELEV', '30')); DIST = float(os.environ.get('DIST', '8.5'))
NEAR = []; BACKN = set(); V9 = {}
def proj_old(p):
    """world -> old ortho logical screen px (inverse of unproj)"""
    u = RIGHT.x*p.x + RIGHT.y*p.y + RIGHT.z*(p.z - 0.5); v = UP.x*p.x + UP.y*p.y + UP.z*(p.z - 0.5)
    return 640 + u*1280/O7, 360 - v*1280/O7
def side_wall(sx, sy0, sy1, hpx, mat, th=0.2):
    A = unproj(sx, sy0); B = unproj(sx, sy1); d = B - A; h = zpx(hpx); c = (A + B)/2; c.z = h/2
    o = box('sidewall', (d.length, th, h), c, mat); o.rotation_euler = (0, 0, math.atan2(d.y, d.x)); return o
def X_office():
    wm = srgb('owall9', (36, 44, 54), rough=0.9); tm = srgb('otrim9', (20, 26, 34)); dk = srgb('odark9', (16, 20, 26), rough=0.8)
    # the floor and side walls run on past the bottom of the frame (no diorama edge)
    floor_rect(70, 680, 1140, 300, floor_mat('ofloor9', tint=(150, 160, 170), rough=0.42))
    for x in (70, 1210): side_wall(x + (-6 if x < 640 else 6), 200, 980, 150, dk)
    # near-camera occluders (between the camera and the walkable floor): a low cubicle partition, two pendants on cables
    fab = srgb('fabric9', (44, 56, 66), rough=0.95); alu = srgb('alu9', (120, 128, 136), metal=0.8, rough=0.35)
    a = unproj(90, 770); b = unproj(470, 770); d = b - a; c = (a + b)/2; h = zpx(95); c.z = h/2
    pt = box('partition', (d.length, 0.08, h), c, fab); pt.rotation_euler = (0, 0, math.atan2(d.y, d.x))
    c2 = c.copy(); c2.z = h + 0.02; cap = box('partcap', (d.length, 0.1, 0.04), c2, alu); cap.rotation_euler = pt.rotation_euler
    NEAR.extend([pt, cap])
    for e in (kp('plantSmall2', 400, 772, s=1.3, z=h + 0.04), kp('desk', 880, 800, s=0.9, val=0.36), kp('chairDesk', 880, 762, 10, s=0.85, val=0.45, sat=0.3),
              kp('computerScreen', 865, 806, 180, s=0.9, z=0.36, val=0.35), kp('trashcan', 1010, 790, s=1.0, val=0.4)):
        NEAR.extend(meshes_of(e))
    shade = srgb('shade9', (24, 26, 30), rough=0.4, metal=0.5); bulb = emit_mat('bulb9', (255, 214, 160), 6.0)
    for sx, sy, z in ((430, 560, 2.25), (870, 600, 2.3)):
        p = unproj(sx, sy, 0)
        bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.26, radius2=0.07, depth=0.22, location=(p.x, p.y, z)); cone = bpy.context.object; cone.data.materials.append(shade)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.06, location=(p.x, p.y, z - 0.09)); bl = bpy.context.object; bl.data.materials.append(bulb)
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.006, depth=6, location=(p.x, p.y, z + 3.1)); cb = bpy.context.object; cb.data.materials.append(shade)
        light('SPOT', (p.x, p.y, z - 0.12), 160, (1.0, 0.78, 0.55), 0.15, spot=70, blend=0.9); aim(ROOM_LIGHTS[-1], (p.x, p.y, 0))
        NEAR.extend([cone, bl, cb])
    # the floor lamp by Noor's desk gets a real light (the LAMP toy changes it)
    p = unproj(1185, 470, 0); light('POINT', (p.x, p.y, 1.35), 55, (1.0, 0.74, 0.48), 0.2); ROOM_LIGHTS[-1].name = 'flamp'
    fg(NEAR, 5000, 'near')
    # the west pod's keyboard sat on top of Noor's phone; the phone is the story, the keyboard goes
    kq = unproj(165, 324, 0.3)
    # snap the photo and the mug onto their desk top (the ortho layout let them float a few cm)
    desks = []
    for o in sc.objects:
        if o.type == 'MESH':
            r = o
            while r.parent: r = r.parent
            if r.name.startswith('desk'): desks.append(o)
    def top_under(p):
        best = None
        for o in desks:
            bb = [o.matrix_world @ Vector(c) for c in o.bound_box]; x0, x1 = min(v.x for v in bb), max(v.x for v in bb); y0, y1 = min(v.y for v in bb), max(v.y for v in bb)
            if x0 - 0.15 < p.x < x1 + 0.15 and y0 - 0.15 < p.y < y1 + 0.15:
                zt = max(v.z for v in bb); best = (zt, (x0, x1, y0, y1)) if best is None or zt > best[0] else best
        return best
    for nm_ in ('photo',):
        o = bpy.data.objects[nm_]; t = top_under(o.location)
        if t: x0, x1, y0, y1 = t[1]; o.location = (min(max(o.location.x, x0 + 0.1), x1 - 0.1), min(max(o.location.y, y0 + 0.08), y1 - 0.08), t[0] + 0.007)
    # Kabir's note goes ON his monitor bezel (it floated in front of it), with its words
    bpy.context.view_layer.update()
    scr2 = [o for a in AMB if a['name'] == 'saver' for o in a['objs']]
    if scr2:
        mw = scr2[0].matrix_world; st_ = bpy.data.objects['sticky']; st_.location = mw @ Vector((0.43, 0.28, 0.03)); st_.rotation_euler = mw.to_euler(); st_.scale = (0.07, 0.07, 1)
        st_.data.materials[0] = img_mat('stickyK', TX9 + 'sticky_kabir.png', emit=0.12, rough=0.8)
    mugs = [o for o in sc.objects if o.type == 'MESH' and o.data.materials and o.data.materials[0].name.startswith('mug')]
    if mugs:
        mugs[0].name = 'mug9'; ph = bpy.data.objects['photo']; m = mugs[0].location
        ph.location = (m.x + RIGHT.x*0.2 + UP.x*0.06, m.y + RIGHT.y*0.2 + UP.y*0.06, m.z - 0.045 + 0.007)
    for n_ in ('phone', 'phonescr'): bpy.data.objects[n_].location.z += 0.05
    for o in list(sc.objects):
        r = o
        while r.parent: r = r.parent
        if r.name.startswith('computerKeyboard') and (r.matrix_world.translation.xy - kq.xy).length < 0.3: o.hide_render = True
ROOMS6['R9_office'] = (lambda: (ROOMS6['R7_office'](), X_office()))

def fit_camera(cam, pts):
    cd = cam.data; cd.shift_x = cd.shift_y = 0
    def bounds():
        bpy.context.view_layer.update(); vs = [world_to_camera_view(sc, cam, p) for p in pts]
        return min(v.x for v in vs), max(v.x for v in vs), min(v.y for v in vs), max(v.y for v in vs)
    lo, hi = 8.0, 200.0
    for _ in range(40):
        cd.lens = (lo + hi)/2; x0, x1, y0, y1 = bounds()
        if x1 - x0 <= 1280/VW and y1 - y0 <= 720/VH: lo = cd.lens
        else: hi = cd.lens
    cd.lens = lo; x0, x1, y0, y1 = bounds()
    cd.shift_x = ((x0 + x1)/2 - 0.5); cd.shift_y = ((y0 + y1)/2 - 0.5)*VH/VW
def camera9():
    cd = bpy.data.cameras.new('cam'); cd.type = 'PERSP'; cd.sensor_fit = 'HORIZONTAL'; cd.sensor_width = 36; cd.clip_start = 0.1; cd.clip_end = 200
    cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
    t = R(90 - ELEV); yw = R(-30); dirv = Vector((math.sin(yw)*math.sin(t), math.cos(yw)*math.sin(t), -math.cos(t)))
    tgt = unproj(640, 440, 0); cam.location = tgt - dirv*DIST; cam.rotation_euler = (t, 0, -yw)
    pts = [unproj(x, y, 0) for x, y in ((70, 200), (1210, 200), (70, 690), (1210, 690))] + [unproj(x, 200, zpx(200)) for x in (300, 980)]
    fit_camera(cam, pts)
    view_data(cam)
def vpx(cam, p):
    v = world_to_camera_view(sc, cam, p); return [v.x*VW - OX, (1 - v.y)*VH - OY]
def view_data(cam):
    bpy.context.view_layer.update()
    src, dst = [], []
    for x in range(0, 1281, 160):
        for y in range(140, 781, 80):
            src.append((x, y)); dst.append(vpx(cam, unproj(x, y, 0)))
    A = []
    for (x, y), (u, v) in zip(src, dst):
        A.append([x, y, 1, 0, 0, 0, -u*x, -u*y, -u]); A.append([0, 0, 0, x, y, 1, -v*x, -v*y, -v])
    _, _, Vt = np.linalg.svd(np.array(A)); Hm = Vt[-1].reshape(3, 3); Hm /= Hm[2, 2]
    err = max(np.hypot(*(np.array([(Hm @ [x, y, 1])[0]/(Hm @ [x, y, 1])[2], (Hm @ [x, y, 1])[1]/(Hm @ [x, y, 1])[2]]) - np.array(d))) for (x, y), d in zip(src, dst))
    # sprite scale: projected px of a 1-unit vertical post vs the ortho sheets (UP.z*1280/O7 px per unit)
    S = []
    for (x, y) in src:
        p0 = unproj(x, y, 0); a = vpx(cam, p0); b = vpx(cam, p0 + Vector((0, 0, 1))); S.append([x, y, abs(a[1] - b[1])/(UP.z*1280/O7)])
    S = np.array(S); co, *_ = np.linalg.lstsq(np.c_[np.ones(len(S)), S[:, 0], S[:, 1]], S[:, 2], rcond=None)
    # inspect / code-line anchors: (old floor sx, sy, height z) of the actual objects
    dh = 0.36
    AN = {'o_coffee': (233, 568, 0.42), 'o_dez': (380, 400, dh + 0.32), 'o_kabir': (668, 280, dh + 0.3), 'o_monitor': (975, 470, dh + 0.3),
          'o_phone': (165, 322, 0.34), 'o_calendar': (300, 200, zpx(200 - 112)), 'o_sticky': (680, 200, zpx(200 - 114)), 'o_printer': (120, 228, 0.75),
          'o_photo': (262, 582, dh + 0.02), 'o_rain': (960, 200, zpx(200 - 130)), 'o_lamp': (1185, 470, 1.25), 'o_line': (1108, 604, 0.0),
          'office_all': (640, 200, zpx(200 - 160)), 'window': (960, 200, zpx(200 - 130))}
    anchors = {k: vpx(cam, unproj(*v)) for k, v in AN.items()}
    win = [vpx(cam, unproj(x, 200, zpx(200 - y))) for x, y in ((760, 72), (1160, 72), (1160, 186), (760, 186))]
    V9.update(H=Hm.tolist(), Hinv=np.linalg.inv(Hm).tolist(), herr=float(err), scale=co.tolist(), anchors=anchors, window=win,
              size=[VW, VH], off=[OX, OY], elev=ELEV, dist=DIST, lens=cam.data.lens)
    EXTRA_LOG['view'] = V9
    print('VIEW9 lens %.1f herr %.2f scale %s' % (cam.data.lens, err, co))

# ---------------- passes ----------------
def objs_back():
    out = []
    for o in sc.objects:
        if o.type not in ('MESH', 'CURVE') or o.hide_render: continue
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box]; cx = sum((p.x for p in bb))/8; cy = sum((p.y for p in bb))/8
        if o.name.startswith('sidewall'): continue
        if proj_old(Vector((cx, cy, 0)))[1] <= 216 and min(p.z for p in bb) > -0.5: out.append(o)
    return out
def full_render(path, holdout=(), hide=(), transparent=False, spp=None):
    sc.use_nodes = False; sc.render.film_transparent = transparent; sc.cycles.samples = spp or SAMPLES
    for o in hide: o.hide_render = True
    for o in holdout: o.is_holdout = True
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)
    for o in hide: o.hide_render = False
    for o in holdout: o.is_holdout = False
def by_mat(name): return [o for o in sc.objects if o.type == 'MESH' and any(s.material and s.material.name.startswith(name) for s in o.material_slots)]
def light_near(col):
    best = None
    for l in ROOM_LIGHTS:
        d = sum(abs(a - b) for a, b in zip(l.data.color, col))
        if best is None or d < best[0]: best = (d, l)
    return best[1]
def variant(v, on):
    """swap variants: 'toys' = rain HAPPY + lamp SAD, 'flip' = photo face up + phone face down, 'claim' = monitor shows DENIED"""
    st = V9.setdefault('_st', {})
    if v == 'toys':
        win = [o for o in sc.objects if o.name.startswith('window')][0]; b = win.active_material.node_tree.nodes['Principled BSDF']
        rl = st.get('rl') or light_near((0.50, 0.66, 0.90)); st['rl'] = rl; fl = bpy.data.objects['flamp']   # keep the SAME light for the restore
        if on:
            st['toys'] = (tuple(b.inputs['Emission Strength'].default_value for _ in [0]), tuple(rl.data.color), rl.data.energy, tuple(fl.data.color), fl.data.energy)
            b.inputs['Emission Strength'].default_value = 1.15; mix = win.active_material.node_tree.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs[0].default_value = 1
            t = [n for n in win.active_material.node_tree.nodes if n.type == 'TEX_IMAGE'][0]; win.active_material.node_tree.links.new(t.outputs['Color'], mix.inputs[6]); mix.inputs[7].default_value = (1.0, 0.62, 0.36, 1)
            win.active_material.node_tree.links.new(mix.outputs[2], b.inputs['Emission Color']); st['mix'] = mix
            rl.data.color = (1.0, 0.72, 0.48); rl.data.energy = 120; fl.data.color = (0.42, 0.58, 1.0); fl.data.energy = 14
        else:
            s0 = st['toys']; b.inputs['Emission Strength'].default_value = s0[0][0]; win.active_material.node_tree.links.new([n for n in win.active_material.node_tree.nodes if n.type == 'TEX_IMAGE'][0].outputs['Color'], b.inputs['Emission Color'])
            rl.data.color = s0[1]; rl.data.energy = s0[2]; fl.data.color = s0[3]; fl.data.energy = s0[4]
    if v == 'flip':
        ph = bpy.data.objects['photo']; phone = bpy.data.objects['phone']; scr = bpy.data.objects['phonescr']
        if on:
            st['flip'] = (ph.location.z, phone.rotation_euler.copy())
            face = plane('photoface', 0.13, 0.09, img_mat('photoup', TX9 + 'photo_up.png', emit=0.15, rough=0.5), ph.location + Vector((0, 0, 0.0075)), rot=ph.rotation_euler); st['face'] = face
            scr.hide_render = True; phone.rotation_euler.x += math.pi; st['phl'] = light('POINT', (phone.location.x, phone.location.y, 0.32), 0.0, (0.5, 0.8, 1), 0.05)
        else:
            bpy.data.objects.remove(st['face']); scr.hide_render = False; phone.rotation_euler = st['flip'][1]
    if v == 'claim':
        dead = by_mat('dead')
        if on:
            st['claim'] = [(o, o.data.materials[0]) for o in dead]
            for o in dead: o.data.materials[0] = img_mat('denied', TX9 + 'monitor_denied.png', emit=1.6, rough=0.2)
            p = unproj(975, 470, 0); st['cl'] = light('POINT', (p.x, p.y, 0.9), 18, (1.0, 0.25, 0.22), 0.1)
        else:
            for o, m in st['claim']: o.data.materials[0] = m
            st['cl'].data.energy = 0
CLOSE = {   # name: (old floor sx, sy, z of the target, azimuth offset deg, elevation deg, distance, lens, variant)
    'phone': (165, 322, 0.36, 6, 64, 0.5, 55, None), 'kabir': (668, 280, 0.53, 0, 30, 0.8, 50, None), 'photo': (262, 582, 0.37, -28, 66, 0.48, 55, None),
    'photo_up': (262, 582, 0.37, -28, 66, 0.48, 55, 'flip'), 'coffee': (233, 568, 0.40, -22, 30, 0.6, 60, None), 'whiteboard': (620, 200, 0.95, 0, 8, 2.2, 45, None),
    'rain': (960, 200, 0.95, -6, 4, 2.4, 40, None), 'rain_happy': (960, 200, 0.95, -6, 4, 2.4, 40, 'toys'), 'monitor': (975, 470, 0.62, 0, 18, 1.0, 55, 'claim')}
CLOSE['coffee'] = (233, 568, 0.40, -10, 48, 0.55, 60, None)
# art-v9b: per-shot exposure (the Kenney whites blow out at close range under the room lights + key), moodier keys
EXPO = {'phone': -0.2, 'kabir': -1.1, 'photo': -0.6, 'photo_up': -0.7, 'coffee': -1.6, 'whiteboard': -1.7, 'rain': -1.1, 'rain_happy': -0.5, 'monitor': -1.1}
CLOSE_OBJ = {'phone': 'phone', 'photo': 'photo', 'photo_up': 'photo', 'coffee': 'mug9'}
CLOSE_DZ = {'coffee': 0.0}
CLOSE_PLATE = {'phone': 'o_phone', 'kabir': 'o_kabir', 'photo': 'o_photo', 'photo_up': 'o_photo', 'coffee': 'o_coffee', 'whiteboard': 'o_sticky', 'rain': 'o_rain', 'rain_happy': 'o_rain', 'monitor': 'o_monitor'}
CLOSE_W = {'whiteboard': 900, 'rain': 900, 'rain_happy': 900, 'monitor': 760, 'kabir': 720}   # in-game entry framing: visible view-px width
DOLLY = int(os.environ.get('DOLLY', '18'))
def _ctr(o): return sum((o.matrix_world @ Vector(c) for c in o.bound_box), Vector())/8
def kabir_target():
    """art-v10: frame Kabir's MONITOR (screen centred, sticky on the right third), not the sticky note"""
    st = bpy.data.objects.get('sticky'); p = st.matrix_world.translation if st else unproj(668, 280, 0.53)
    cands = [o for o in sc.objects if o.type == 'MESH' and not o.hide_render and any(k in o.name.lower() for k in ('monitor', 'screen', 'computer', 'display'))]
    best = min(cands, key=lambda o: (_ctr(o) - p).length) if cands else None
    print('KABIR monitor', best.name if best else None)
    return (_ctr(best) if best else p) + Vector((0, 0, 0.0))
def _cam_at(cam, loc, quat, lens, sx, sy):
    cam.location = loc; cam.rotation_mode = 'QUATERNION'; cam.rotation_quaternion = quat; cam.data.lens = lens; cam.data.shift_x = sx; cam.data.shift_y = sy
def closeups(names):
    cam = sc.camera; cam.rotation_mode = 'XYZ'
    keep = (cam.location.copy(), cam.rotation_euler.copy(), cam.data.lens, cam.data.shift_x, cam.data.shift_y)
    q0 = cam.rotation_euler.to_quaternion(); rw, rh = sc.render.resolution_x, sc.render.resolution_y
    sc.render.film_transparent = False; sc.use_nodes = False
    rain = [o for a in AMB if a['name'] == 'rain' for o in a['objs']]
    VIEW = V9; offx, offy = 80, 45
    for nm in names:
        sx, sy, z, az, el, dist, lens, var = CLOSE[nm]
        if var: variant(var, True)
        if nm.startswith('rain'):
            for o in rain: o.hide_render = False
            [a for a in AMB if a['name'] == 'rain'][0]['pose'](3)
            if nm == 'rain_happy':   # lighter rain: most streaks gone, the rest catch warm light
                for k, o in enumerate(rain): o.hide_render = (k % 3 != 0)
        tgt = unproj(sx, sy, z); t = R(90 - el)
        on = CLOSE_OBJ.get(nm)
        if on and on in bpy.data.objects: tgt = bpy.data.objects[on].matrix_world.translation.copy() + Vector((0, 0, CLOSE_DZ.get(nm, 0)))
        if nm == 'kabir': tgt = kabir_target()
        # ---- entry framing: where the in-game camera will be when the dolly starts (the room render, cropped) ----
        _cam_at(cam, keep[0], q0, keep[2], keep[3], keep[4]); bpy.context.view_layer.update()
        cx, cy = vpx(cam, tgt); W = CLOSE_W.get(nm, 700); Hh = W*626/1113
        cx = min(max(cx, -80 + W/2), 1360 - W/2); cy = min(max(cy, -45 + Hh/2), 765 - Hh/2)
        rx, ry = cx + offx, cy + offy   # render px
        k_ = 1440/W; L_s = keep[2]*k_; sx_s = (keep[3] + (rx/1440 - 0.5))*k_; sy_s = (keep[4] + (0.5 - ry/810)*810/1440)*k_
        VIEW.setdefault('close', {})[nm] = dict(cx=round(cx, 1), cy=round(cy, 1), w=W, frames=DOLLY)
        # ---- close-up camera ----
        yw = R(-30 + az)
        d = Vector((math.sin(yw)*math.sin(t), math.cos(yw)*math.sin(t), -math.cos(t)))
        e_loc = tgt - d*dist; e_q = Euler((t, 0, -yw)).to_quaternion()
        _cam_at(cam, e_loc, e_q, lens, 0, 0); bpy.context.view_layer.update()
        sc.render.resolution_x, sc.render.resolution_y = 1120, 630
        hid = []
        fr = [cam.matrix_world @ v for v in cam.data.view_frame(scene=sc)]
        for _ in range(4):
            hit_any = False; dg = bpy.context.evaluated_depsgraph_get()
            for i in range(13):
                for j in range(9):
                    a = fr[3].lerp(fr[0], i/12); b = fr[2].lerp(fr[1], i/12); q = a.lerp(b, j/8); dv = (q - cam.location).normalized()
                    ok, loc, nrm, fi, ob, mt = sc.ray_cast(dg, cam.location, dv, distance=dist - 0.07)
                    if ok and ob and ob.name in sc.objects and not sc.objects[ob.name].hide_render: sc.objects[ob.name].hide_render = True; hid.append(sc.objects[ob.name]); hit_any = True
            if not hit_any: break
            bpy.context.view_layer.update()
        for o in sc.objects:
            if o.type == 'MESH' and o.name.startswith('chair') and not o.hide_render and (o.matrix_world.translation.xy - tgt.xy).length < 1.0: o.hide_render = True; hid.append(o)
        saver = [o for a in AMB if a['name'] == 'saver' for o in a['objs']] if nm == 'kabir' else []
        for o in saver: o.hide_render = False
        print('CLOSEHID', nm, [o.name for o in hid])
        KE, RE = 2.6, 3.0
        key = light('AREA', tuple(tgt + Vector((0.5, -0.6, 0.9))), KE, (1.0, 0.78, 0.56), 0.6); aim(key, tuple(tgt))
        rim = light('AREA', tuple(tgt + Vector((-0.7, 0.8, 0.5))), RE, (0.45, 0.75, 1.0), 0.5); aim(rim, tuple(tgt))
        warm = None
        if nm == 'rain_happy':   # warm light pours through the glass and onto the sill / floor
            warm = light('AREA', tuple(tgt + Vector((0.0, 1.2, 0.4))), 60, (1.0, 0.66, 0.38), 1.6); aim(warm, tuple(tgt - Vector((0, 0, 0.6))))
        def setk(e):
            key.data.energy = KE*e; rim.data.energy = RE*e
            if warm: warm.data.energy = 60*e
            sc.view_settings.exposure = EXPO.get(nm, -1.0)*e
        cam.data.dof.use_dof = True
        # ---- the hero still ----
        setk(1); cam.data.dof.focus_distance = dist; cam.data.dof.aperture_fstop = 1.6 if dist < 1 else 2.8
        sc.cycles.samples = max(32, SAMPLES)
        if not os.environ.get('NOSTILL'):
            sc.render.filepath = os.path.join(OUT, 'R9_close_%s.png' % nm); bpy.ops.render.render(write_still=True)
        # ---- the dolly: room-camera crop -> close-up camera (eased), lights/exposure/DoF ramp in with it ----
        sc.render.resolution_x, sc.render.resolution_y = int(os.environ.get('DOLLY_W', '800')), int(os.environ.get('DOLLY_W', '800'))*9//16
        sc.cycles.samples = int(os.environ.get('DOLLY_SPP', '20'))
        for k in range(DOLLY if DOLLY > 1 else 0):
            u = k/(DOLLY - 1); e = u*u*(3 - 2*u)
            # perspective-correct: interpolate the field of view (1/lens), not the lens
            Ls = 1/((1 - e)/L_s + e/lens)
            _cam_at(cam, keep[0].lerp(e_loc, e), q0.slerp(e_q, e), Ls, sx_s*(1 - e), sy_s*(1 - e))
            setk(e); bpy.context.view_layer.update()
            cam.data.dof.focus_distance = (tgt - cam.location).length
            cam.data.dof.aperture_fstop = 64*(1 - e) + (1.6 if dist < 1 else 2.8)*e if e > 0 else 128
            sc.render.filepath = os.path.join(OUT, 'R9_dolly_%s_%02d.png' % (nm, k)); bpy.ops.render.render(write_still=True)
        for l in (key, rim) + ((warm,) if warm else ()): l.data.energy = 0
        for o in hid: o.hide_render = False
        for o in saver: o.hide_render = True
        if nm.startswith('rain'):
            for o in rain: o.hide_render = True
        if var: variant(var, False)
    cam.rotation_mode = 'XYZ'; cam.location, cam.rotation_euler, cam.data.lens, cam.data.shift_x, cam.data.shift_y = keep; cam.data.dof.use_dof = False; sc.view_settings.exposure = 0
    sc.render.resolution_x, sc.render.resolution_y = rw, rh
def passes9():
    P = os.environ.get('PASSES9', 'layers,near,variants,close').split(',')
    back = objs_back(); V9['back_count'] = len(back)
    near = [o for o in sc.objects if o.type in ('MESH', 'CURVE') and o.pass_index == [f['idx'] for f in FG if f['name'] == 'near'][0]]
    if 'layers' in P:
        full_render(os.path.join(OUT, 'R9_office_L_back.png'), hide=[o for o in sc.objects if o.type in ('MESH', 'CURVE') and o not in back and not o.hide_render])
        full_render(os.path.join(OUT, 'R9_office_L_mid.png'), holdout=back, hide=near, transparent=True)
    if 'variants' in P:
        for v in os.environ.get('VARS9', 'toys,flip,claim').split(','):
            variant(v, True)
            full_render(os.path.join(OUT, 'R9_office_V_%s_back.png' % v), hide=[o for o in sc.objects if o.type in ('MESH', 'CURVE') and o not in back and not o.hide_render])
            full_render(os.path.join(OUT, 'R9_office_V_%s_mid.png' % v), holdout=back, hide=near, transparent=True)
            variant(v, False)
        # matching base layers without the near layer were rendered above (L_back / L_mid)
    if 'close' in P: closeups(os.environ.get('CLOSE9', ','.join(CLOSE)).split(','))
    V9.pop('_st', None)
    json.dump(dict(actors=ACTOR_LOG, cam_target=list(CAM_T), extra=EXTRA_LOG), open(os.path.join(OUT, MODE+'_actors.json'), 'w'), indent=1, default=str)
