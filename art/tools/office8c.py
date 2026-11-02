# art-v11: close-up shots for the OLD-ANGLE office (art-v7/v8 ortho 38deg camera, the default office again).
# exec'd by scene7.py for MODE R8C_office (after office9.py, whose close-up table / variants / lights it reuses).
# Per close-up: a hero still + an N-frame camera move that starts EXACTLY on the game's entry framing of the old plate
# (an ortho crop, approximated by a far, long-lens perspective camera) and ends on the close-up camera. Width-of-view and
# distance are interpolated in log space (no mid-move zoom-out), aim point / rotation slerp, lights + exposure + DoF ramp.
# Occluders the close-up must lose (chairs, keyboards) stay put for the first ~55% of the move, then go while the DoF is heavy.
import json
def X_office8():
    """only the 'make the story props sit right' part of X_office (no new walls / pendants / near layer: the old plate stays the old plate)"""
    p = unproj(1185, 470, 0); light('POINT', (p.x, p.y, 1.35), 0.0, (1.0, 0.74, 0.48), 0.2); ROOM_LIGHTS[-1].name = 'flamp'
    kq = unproj(165, 324, 0.3); bpy.context.view_layer.update()
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
ROOMS6['R8C_office'] = (lambda: (ROOMS6['R7_office'](), X_office8()))
CLOSE_W8 = {'whiteboard': 520, 'rain': 560, 'rain_happy': 560, 'monitor': 420, 'kabir': 400}   # old plate px visible at the entry framing
VW, VH = 1280, 720
def closeups8(names, OUT):
    cam = sc.camera; o_loc = cam.location.copy(); o_rot = cam.rotation_euler.copy(); ORTHO = cam.data.ortho_scale
    q0 = o_rot.to_quaternion(); M3 = q0.to_matrix(); right = M3 @ Vector((1, 0, 0)); up = M3 @ Vector((0, 1, 0)); fwd = M3 @ Vector((0, 0, -1))
    sc.render.film_transparent = False; sc.use_nodes = False
    rain = [o for a in AMB if a['name'] == 'rain' for o in a['objs']]; meta = {}
    D0 = float(os.environ.get('FAR', '120'))
    for nm in names:
        sx, sy, z, az, el, dist, lens, var = CLOSE[nm]
        if var: variant(var, True)
        if nm.startswith('rain'):
            for o in rain: o.hide_render = False
            [a for a in AMB if a['name'] == 'rain'][0]['pose'](3)
            if nm == 'rain_happy':
                for k, o in enumerate(rain): o.hide_render = (k % 3 != 0)
        tgt = unproj(sx, sy, z); on = CLOSE_OBJ.get(nm)
        if on and on in bpy.data.objects: tgt = bpy.data.objects[on].matrix_world.translation.copy() + Vector((0, 0, CLOSE_DZ.get(nm, 0)))
        if nm == 'kabir': tgt = kabir_target()
        # entry framing on the old plate (game world px == plate px)
        cam.data.type = 'ORTHO'; cam.data.ortho_scale = ORTHO; cam.location = o_loc; cam.rotation_mode = 'XYZ'; cam.rotation_euler = o_rot; cam.data.shift_x = cam.data.shift_y = 0
        bpy.context.view_layer.update(); v = world_to_camera_view(sc, cam, tgt); cx, cy = v.x*VW, (1 - v.y)*VH
        W = CLOSE_W8.get(nm, 380); Hh = W*VH/VW; cx = min(max(cx, W/2), VW - W/2); cy = min(max(cy, Hh/2), VH - Hh/2)
        ox = (cx/VW - 0.5)*ORTHO; oy = (0.5 - cy/VH)*ORTHO*VH/VW
        O = o_loc + right*ox + up*oy; tq = (tgt - O).dot(fwd); Q = O + fwd*tq   # crop centre at the target's depth
        ws = ORTHO*W/VW                                                            # world width seen at the entry framing
        t = R(90 - el); yw = R(-30 + az); d = Vector((math.sin(yw)*math.sin(t), math.cos(yw)*math.sin(t), -math.cos(t)))
        e_q = Euler((t, 0, -yw)).to_quaternion(); we = 36*dist/lens
        meta[nm] = dict(cx=round(cx, 1), cy=round(cy, 1), w=W, frames=DOLLY, k=[])
        # occluders as seen by the close-up camera
        cam.data.type = 'PERSP'; cam.data.sensor_fit = 'HORIZONTAL'; cam.data.sensor_width = 36; cam.data.clip_start = 0.05; cam.data.clip_end = 400
        _cam_at(cam, tgt - d*dist, e_q, lens, 0, 0); sc.render.resolution_x, sc.render.resolution_y = 1120, 630; bpy.context.view_layer.update()
        hid = []; fr = [cam.matrix_world @ v_ for v_ in cam.data.view_frame(scene=sc)]
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
        KE, RE = 2.6, 3.0
        key = light('AREA', tuple(tgt + Vector((0.5, -0.6, 0.9))), KE, (1.0, 0.78, 0.56), 0.6); aim(key, tuple(tgt))
        rim = light('AREA', tuple(tgt + Vector((-0.7, 0.8, 0.5))), RE, (0.45, 0.75, 1.0), 0.5); aim(rim, tuple(tgt))
        warm = None
        if nm == 'rain_happy':
            warm = light('AREA', tuple(tgt + Vector((0.0, 1.2, 0.4))), 60, (1.0, 0.66, 0.38), 1.6); aim(warm, tuple(tgt - Vector((0, 0, 0.6))))
        def setk(e):
            key.data.energy = KE*e; rim.data.energy = RE*e
            if warm: warm.data.energy = 60*e
            sc.view_settings.exposure = EXPO.get(nm, -1.0)*e
        cam.data.dof.use_dof = True
        setk(1); cam.data.dof.focus_distance = dist; cam.data.dof.aperture_fstop = 1.6 if dist < 1 else 2.8; sc.cycles.samples = max(32, SAMPLES)
        if not os.environ.get('NOSTILL'): sc.render.filepath = os.path.join(OUT, 'R8_close_%s.png' % nm); bpy.ops.render.render(write_still=True)
        for o in hid: o.hide_render = False   # back for the early part of the move
        sc.render.resolution_x = int(os.environ.get('DOLLY_W', '800')); sc.render.resolution_y = sc.render.resolution_x*9//16
        sc.cycles.samples = int(os.environ.get('DOLLY_SPP', '20'))
        for k in range(DOLLY):
            u = k/(DOLLY - 1); e = u*u*(3 - 2*u)
            if e > 0.55:
                for o in hid: o.hide_render = True
            w = math.exp(math.log(ws)*(1 - e) + math.log(we)*e); dd = math.exp(math.log(D0)*(1 - e) + math.log(dist)*e)
            q = q0.slerp(e_q, e); fw = q.to_matrix() @ Vector((0, 0, -1)); A = Q.lerp(tgt, e)
            _cam_at(cam, A - fw*dd, q, 36*dd/w, 0, 0); setk(e); bpy.context.view_layer.update()
            cam.data.clip_start = max(0.05, dd - 19.5)   # the ortho camera sat 20 units out: nothing between it and the far camera may render
            cam.data.dof.focus_distance = dd; cam.data.dof.aperture_fstop = 128 if e == 0 else 64*(1 - e) + (1.6 if dist < 1 else 2.8)*e
            meta[nm]['k'].append(round(ws/w, 4))   # zoom factor vs the entry framing (the game moves Noor's held sprite with it)
            sc.render.filepath = os.path.join(OUT, 'R8_dolly_%s_%02d.png' % (nm, k)); bpy.ops.render.render(write_still=True)
        for l in (key, rim) + ((warm,) if warm else ()): l.data.energy = 0
        for o in hid: o.hide_render = False
        for o in saver: o.hide_render = True
        if nm.startswith('rain'):
            for o in rain: o.hide_render = True
        if var: variant(var, False)
    json.dump(meta, open(os.path.join(OUT, 'R8_close_meta.json'), 'w'), indent=1)
