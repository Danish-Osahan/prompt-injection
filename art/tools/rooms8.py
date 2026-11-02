# art-v8 "linger" layer: small story props (static, in the clean plates) + AMBIENT loops rendered as their own frames.
# amb(name, objs, frames, pose, base_y, fps): objs are hidden in the clean plate; scene7 (AMBPASS=1) renders each frame of
# each loop alone (everything else holdout, cropped render border) -> R7_<room>_amb_<name>_<NN>.png; post7 crops + packs a strip.
# Lost lines (the per-room collectible) are 1-frame amb layers so the game can show / fade them on their own.
TX8 = T5 + '../tex/'
AMB = []
def amb(name, objs, frames, pose=None, base_y=0, fps=8, mode='loop'):
    AMB.append(dict(name=name, objs=list(objs), frames=frames, pose=pose, base_y=base_y))
    EXTRA_LOG.setdefault('amb', []).append(dict(name=name, frames=frames, base_y=base_y, fps=fps, mode=mode))
def img_mat_a(name, path, emit=0.0, rough=0.6):
    m = img_mat(name, path, emit=emit, rough=rough); nt = m.node_tree; t = [n for n in nt.nodes if n.type == 'TEX_IMAGE'][0]
    nt.links.new(t.outputs['Alpha'], nt.nodes['Principled BSDF'].inputs['Alpha']); m.blend_method = 'BLEND' if hasattr(m, 'blend_method') else None
    return m
def lost_line(sx, sy, z=0.004, rz=12, base_y=None):
    """the collectible: a torn strip of Noor's handwriting, lying flat, faintly warm"""
    p = unproj(sx, sy, z); o = plane('lostline', 0.30, 0.075, img_mat_a('lostline', TX8+'lostline.png', emit=0.9), (p.x, p.y, z + 0.003), rot=(0, 0, R(SCR_RZ + rz)))
    l = light('POINT', (p.x, p.y, z + 0.18), 2.0, (1.0, 0.8, 0.55), 0.1)
    amb('line', [o], 1, None, base_y if base_y is not None else sy - 4, 1, 'still'); return o
def wall_tex(sx0, sx1, syt, syb, syf, tex, emit=0.2, eps=0.03, name='walltex'):
    return on_wall(sx0, sx1, syt, syb, syf, img_mat(name, tex, emit=emit, rough=0.7), eps=eps, name=name)
def drop(name, sx, sy, z, r, mat):
    q = unproj(sx, sy, z); bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=r, location=q); o = bpy.context.object; o.name = name; o.data.materials.append(mat); return o
def ring(name, sx, sy, z, r, mat, minor=0.004):
    q = unproj(sx, sy, z); bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=minor, location=q); o = bpy.context.object; o.name = name; o.data.materials.append(mat); return o
def moth_mesh(mat):
    # art-v9: ~2x bigger so the loop reads at game size (was a 3-px speck)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=4, radius=0.024, location=(0, 0, 0)); body = bpy.context.object; body.scale = (1, 2.4, 1); body.data.materials.append(mat)
    wings = []
    for sgn in (-1, 1):
        w = plane('wing', 0.1, 0.08, mat, (sgn*0.056, 0, 0)); w.parent = body; wings.append(w)
    return body, wings

# ---------------- OFFICE ----------------
def L_office():
    dh = 0.36
    # Noor's phone, face up on the west pod: 37 unread
    q = unproj(165, 322, 0.30); box('phone', (0.08, 0.15, 0.012), (q.x, q.y, 0.31), srgb('phoneb', (20, 22, 28), metal=0.4), rot=(0, 0, R(SCR_RZ + 20)))
    plane('phonescr', 0.07, 0.14, img_mat('phonescr', TX8+'phone_37.png', emit=1.1), (q.x, q.y, 0.3175), rot=(0, 0, R(SCR_RZ + 20)))
    # a calendar stuck on August, between the lift and the kitchenette
    wall_tex(282, 318, 92, 138, 200, TX8+'calendar_aug.png', emit=0.12, name='calendar')
    # a sticky note on the whiteboard: CALL, then a crossed-out name
    wall_tex(668, 692, 102, 126, 200, TX8+'sticky_call.png', emit=0.15, eps=0.04, name='stickycall')
    # rain running down the glass (ambient): streak planes that slide down and wrap, + a few slow beads
    n_ = away(760, 200); rm = emit_mat('rain8', (150, 190, 220), 0.45); rnd = random.Random(21); streaks = []
    zt, zb = zpx(200 - 76), zpx(200 - 184)
    for i in range(46):
        sx = rnd.uniform(766, 1154); L = zpx(rnd.uniform(8, 20)); A = unproj(sx, 200); p = A - n_*0.035
        o = plane('rain', 0.0035, L, rm, (p.x, p.y, zt), rot=(R(90), R(rnd.uniform(-6, -2)), math.atan2(RIGHT.y, RIGHT.x)))
        o['ph'] = rnd.random(); o['L'] = L; o['sp'] = rnd.choice((1, 1, 2)); streaks.append(o)
    bead = srgb('bead', (190, 215, 235), rough=0.05); beads = []
    for i in range(9):
        sx = rnd.uniform(770, 1150); A = unproj(sx, 200); p = A - n_*0.04
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=5, radius=0.009, location=(p.x, p.y, zt)); o = bpy.context.object; o.data.materials.append(bead); o['ph'] = rnd.random(); o['L'] = 0; o['sp'] = 0.34; beads.append(o)
    def rain_pose(k, N=12):
        for o in streaks + beads:
            u = (o['ph'] + o['sp']*k/N) % 1.0; o.location.z = zt - u*(zt - zb) - o['L']/2
            o.hide_render = False
    amb('rain', streaks + beads, 12, rain_pose, 200, 12)
    # Kabir's monitor: a slow fern-leaf screensaver (texture flipbook)
    m2 = [o for o in sc.objects if o.name.startswith('screen') and o.parent and o.parent.name.startswith('computerScreen')]
    scr = None
    bpy.context.view_layer.update()
    m2 = [o for o in sc.objects if o.name.startswith('screen') and o.type == 'MESH']
    for o in sorted(m2, key=lambda o: (o.matrix_world.translation.xy - unproj(668, 280, dh).xy).length)[:1]: scr = o
    if scr:
        imgs = [bpy.data.images.load(TX8+'saver_%02d.png' % k) for k in range(12)]
        sm = img_mat('saver', TX8+'saver_00.png', emit=1.0, rough=0.2); scr.data.materials[0] = sm
        tnode = [n for n in sm.node_tree.nodes if n.type == 'TEX_IMAGE'][0]
        def saver_pose(k): tnode.image = imgs[k]
        amb('saver', [scr], 12, saver_pose, 330, 4)
    lost_line(1108, 604, base_y=600)

# ---------------- HUB ----------------
def L_hub():
    # the clock's hands: real meshes, running backwards (ambient; the toy flips the playback)
    c = HUBCLOCK['c'] + HUBCLOCK['n']*0.012; nrm = HUBCLOCK['n']; hm = srgb('hands', (26, 30, 44), rough=0.4); red = emit_mat('sec', (240, 110, 110), 1.2)
    piv = bpy.data.objects.new('hands', None); sc.collection.objects.link(piv); piv.location = c
    piv.rotation_euler = (R(90), 0, math.atan2(RIGHT.y, RIGHT.x))
    hands = []
    for L, w, mat, nm in ((0.15, 0.016, hm, 'minute'), (0.10, 0.022, hm, 'hour'), (0.17, 0.006, red, 'second')):
        hpv = bpy.data.objects.new('hpiv', None); sc.collection.objects.link(hpv); hpv.parent = piv; hpv.location = (0, 0, 0)
        o = box(nm, (w, L, 0.006), (0, 0, 0), mat); o.parent = hpv; o.location = (0, L/2 - 0.02, 0); o['pv'] = hpv.name; hands.append(o)
    def clock_pose(k, N=16):
        a = 2*math.pi*k/N
        for o, ang in zip(hands, (R(140) + a/12, R(250) + a/144, a)): bpy.data.objects[o['pv']].rotation_euler = (0, 0, ang)
    amb('clock', hands, 16, clock_pose, 160, 4)
    # glyph motes falling down the dash gap (ambient)
    rnd = random.Random(9); mm = emit_mat('mote8', (130, 220, 230), 1.6); motes = []
    for i in range(26):
        sx, sy = rnd.uniform(90, 1190), rnd.uniform(262, 314); bpy.ops.mesh.primitive_cube_add(size=0.022, location=unproj(sx, sy, -0.4)); o = bpy.context.object
        o.data.materials.append(mm); o['ph'] = rnd.random(); o['sx'] = sx; o['sy'] = sy; motes.append(o)
    def mote_pose(k, N=16):
        for o in motes:
            u = (o['ph'] + k/N) % 1.0; p = unproj(o['sx'], o['sy'], -0.2 - u*2.4); o.location = p; o.rotation_euler = (u*6, u*4, 0)
    amb('motes', motes, 16, mote_pose, 300, 10)
    # Fern's stack of sticky notes: all the same two words
    q = unproj(985, 548, 0.0); dz = 0.36
    for k in range(5): box('gm', (0.075, 0.075, 0.004), (q.x, q.y, dz + 0.004 + k*0.004), img_mat('gm', TX8+'sticky_gm.png', emit=0.25), rot=(0, 0, R(SCR_RZ + k*7 - 12)))
    lost_line(332, 222, base_y=222)

# ---------------- CORRIDOR ----------------
def L_corridor():
    lit = STATE == 'lit'
    # a mop bucket under a slow drip (ambient), an umbrella that has never met weather, tape marks where a desk was dragged out
    bm = srgb('bucket', (70, 96, 120), rough=0.4); q = unproj(724, 344)
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.12, depth=0.2, location=(q.x, q.y, 0.1)); bk = bpy.context.object; bk.data.materials.append(bm)
    wq = srgb('bwater', (30, 50, 66), rough=0.05); bpy.ops.mesh.primitive_circle_add(vertices=20, radius=0.11, fill_type='NGON', location=(q.x, q.y, 0.17)); bpy.context.object.data.materials.append(wq)
    dm = emit_mat('drip', (190, 225, 240), 0.5); rmat = emit_mat('dring', (150, 200, 220), 0.9)
    d0 = drop('drop', 724, 344, 0.9, 0.026, dm); r0 = ring('dripring', 724, 344, 0.172, 0.05, rmat, 0.008)   # art-v9: bigger drop + ring
    def drip_pose(k, N=10):
        if k < 7: d0.hide_render = False; d0.location.z = 0.9 - (0.9 - 0.18)*(k/6)**2; r0.hide_render = True
        else: d0.hide_render = True; r0.hide_render = False; s = 0.6 + (k - 7)*0.7; r0.scale = (s, s, 1)
    amb('drip', [d0, r0], 10, drip_pose, 346, 8)
    um = srgb('umb', (40, 44, 70), rough=0.5); uq = unproj(486, 334)
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.04, radius2=0.012, depth=0.55, location=(uq.x, uq.y, 0.3), rotation=(R(-12), R(8), 0)); bpy.context.object.data.materials.append(um)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.03, minor_radius=0.008, location=(uq.x, uq.y + 0.04, 0.6), rotation=(R(90), 0, R(SCR_RZ))); bpy.context.object.data.materials.append(srgb('umbh', (120, 90, 60)))
    tape = srgb('tape', (200, 180, 90), rough=0.8)
    for (x, y, w, h) in ((770, 398, 28, 4), (770, 398, 4, 14), (870, 398, 28, 4), (894, 398, 4, 14), (770, 450, 28, 4), (770, 440, 4, 14), (870, 450, 28, 4), (894, 440, 4, 14)):
        floor_rect(x, y, w, h, tape, z=0.003, solid=0.0)
    # a moth that keeps the lamp company (ambient): pale wings, a little self-lit so it reads in the dark too
    mm = emit_mat('moth', (230, 220, 196), 0.9 if not lit else 1.1); body, wings = moth_mesh(mm)
    lp = unproj(360, 330); n = away(360, 330); cen = Vector((lp.x - n.x*0.25, lp.y - n.y*0.25, zpx(330 - 262)))
    def moth_pose(k, N=16):
        a = 2*math.pi*k/N; body.location = cen + Vector((math.cos(a)*0.22, math.sin(a)*0.14, 0.05*math.sin(2*a) - 0.04)); body.rotation_euler = (0, 0, a + R(90))
        f = R(70) if k % 2 else R(-10)
        wings[0].rotation_euler = (0, -f, 0); wings[1].rotation_euler = (0, f, 0)
    amb('moth', [body] + wings, 16, moth_pose, 300, 12)
    lost_line(236, 256, base_y=256)

# ---------------- ARCHIVE ----------------
def L_archive():
    high = STATE[:1] != 'L'
    wz = -0.12 if high else -0.95 + 0.012
    # a leaking pipe elbow over the pit; it drips (ambient)
    met = srgb('pipe8', (70, 84, 92), rough=0.35, metal=0.8)
    on_wall(694, 706, 56, 150, 180, met, eps=0.05, name='pipe2')
    p0 = unproj(700, 180); n = away(700, 180); top = Vector((p0.x - n.x*0.12, p0.y - n.y*0.12, zpx(180 - 150)))
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.04, depth=0.22, location=top, rotation=(R(90), 0, math.atan2(RIGHT.y, RIGHT.x) + R(90))); bpy.context.object.data.materials.append(met)
    dm = emit_mat('adrip', (190, 225, 240), 0.5); rmat = emit_mat('aring', (150, 210, 230), 0.9)
    tip = top - Vector((n.x*0.1, n.y*0.1, 0.04)); d0 = drop('adrop', 0, 0, 0, 0.03, dm); d0.location = tip
    from bpy_extras.object_utils import world_to_camera_view
    hit = Vector((tip.x, tip.y, wz)); r0 = ring('aripple', 0, 0, 0, 0.08, rmat, 0.009); r0.location = hit; r1 = ring('aripple2', 0, 0, 0, 0.08, rmat, 0.007); r1.location = hit
    def drip_pose(k, N=14):
        if k < 8: d0.hide_render = False; d0.location = tip.lerp(hit, (k/7)**2); r0.hide_render = r1.hide_render = True
        else:
            d0.hide_render = True; r0.hide_render = False; s = 0.5 + (k - 8)*0.8; r0.scale = (s, s, 1); r1.hide_render = k < 10; s1 = max(0.3, (k - 10)*0.8); r1.scale = (s1, s1, 1)
    amb('drip', [d0, r0, r1], 14, drip_pose, 200, 10)
    # the rubber duck (toy: AFLOAT) and the memo that wants to float (toy: SUNK)
    yel = srgb('duck', (240, 200, 70), rough=0.3); dq = unproj(560, 470, wz)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.12, location=(dq.x, dq.y, wz + 0.07)); db = bpy.context.object; db.scale = (1.3, 1, 0.8); db.data.materials.append(yel)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.075, location=(dq.x - 0.085, dq.y - 0.05, wz + 0.19)); dh_ = bpy.context.object; dh_.data.materials.append(yel)
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.034, radius2=0.0, depth=0.07, location=(dq.x - 0.16, dq.y - 0.085, wz + 0.18), rotation=(0, R(-90), R(SCR_RZ))); bk = bpy.context.object; bk.data.materials.append(srgb('beak', (230, 120, 50)))
    duck = [db, dh_, bk]; base = [o.location.copy() for o in duck]
    def duck_pose(k, N=12):
        dz = 0.02*math.sin(2*math.pi*k/N) if high else 0.0; tilt = R(5)*math.sin(2*math.pi*k/N + 1) if high else R(12)
        for o, b in zip(duck, base): o.location = b + Vector((0, 0, dz))
        db.rotation_euler = (tilt, 0, 0)
    amb('duck', duck, 12 if high else 1, duck_pose, 471, 6)
    mq = unproj(620, 560, wz); memo = plane('memo', 0.2, 0.25, img_mat('memo', TX8+'memo.png', emit=0.2, rough=0.9), (mq.x, mq.y, wz + 0.006), rot=(0, 0, R(SCR_RZ + 25)))
    amb('memo', [memo], 1, None, 561, 1, 'still')
    if high:    # the memo, drowned, as the plate shows it: a pale shape under the water
        sq = unproj(620, 560, -0.6); plane('memo_sunk', 0.2, 0.25, srgb('memos', (140, 150, 150), rough=0.9), (sq.x, sq.y, -0.6), rot=(R(8), 0, R(SCR_RZ + 40)))
    # a radio on the cabinet, tuned between stations; a pair of wellies by the east wall
    rq = unproj(180, 196, 0.9); box('radio', (0.24, 0.1, 0.14), (rq.x, rq.y, 0.97), srgb('radio', (120, 64, 48), rough=0.5), rot=(0, 0, R(SCR_RZ)))
    on_wall(170, 178, 120, 126, 196, emit_mat('rdial', (246, 198, 132), 1.2), eps=-0.06, name='rdial')
    bm = srgb('boot', (34, 56, 48), rough=0.4)
    for k, sx in enumerate((892, 910)):
        q = unproj(sx, 262); bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.045, depth=0.24, location=(q.x, q.y, 0.12)); bpy.context.object.data.materials.append(bm)
        q2 = unproj(sx - 6, 268); box('toe', (0.09, 0.14, 0.05), (q2.x, q2.y, 0.025), bm, rot=(0, 0, R(SCR_RZ + 70)))
    lost_line(330, 640, base_y=640)

# ---------------- ARENA ----------------
def L_arena():
    # paper flakes drifting down through the lamp cone (ambient) + a pulse that walks round the rim (ambient)
    pm = srgb('flake', (226, 222, 210), rough=0.8); rnd = random.Random(31); flakes = []
    for i in range(12):
        sx, sy = rnd.uniform(470, 810), rnd.uniform(260, 560); o = plane('flake', 0.07, 0.09, pm, unproj(sx, sy, 2.0))
        o['ph'] = rnd.random(); o['sx'] = sx; o['sy'] = sy; o['sp'] = rnd.uniform(0.6, 1.4); flakes.append(o)
    def flake_pose(k, N=24):
        for o in flakes:
            u = (o['ph'] + k/N) % 1.0; z = 2.6 - u*2.6; p = unproj(o['sx'] + 18*math.sin(u*9 + o['ph']*6), o['sy'], z); o.location = p
            o.rotation_euler = (u*7*o['sp'], u*5, u*3)
    amb('flakes', flakes, 24, flake_pose, 2000, 10)
    rims = [o for o in sc.objects if o.name.startswith('rim') and o.type == 'MESH']
    hot = emit_mat('rimhot', (190, 250, 250), 2.4); base = rims[0].data.materials[0] if rims else None
    for i, o in enumerate(rims): o.data = o.data.copy(); o['i'] = i
    def rim_pose(k, N=16):
        for o in rims:
            d = (o['i'] - k*len(rims)/N) % len(rims); o.data.materials[0] = hot if d < 4 else base
    amb('rim', rims, 16, rim_pose, -1, 8)
    # one folding chair facing the ring; a scrap that only ever got as far as "Honestly,"
    kp('chair', 868, 628, 215, s=0.85, val=0.4, sat=0.3)
    q = unproj(520, 600, 0.004); plane('scrap', 0.2, 0.25, img_mat('scrap', TX8+'memo.png', emit=0.25, rough=0.9), (q.x, q.y, 0.006), rot=(0, 0, R(SCR_RZ - 30)))
    lost_line(640, 262, base_y=262)

# ---------------- MESSAGE ROOM ----------------
def L_message():
    # the chat wall breathes (ambient flipbook); the potted plant leans toward the screen, slowly (ambient)
    cw = [o for o in sc.objects if o.name.startswith('chatwall')]
    if cw:
        imgs = [bpy.data.images.load(TX8+'chatglow_%02d.png' % k) for k in range(8)]
        m = img_mat('chatglow', TX8+'chatglow_00.png', emit=1.0, rough=0.3); cw[0].data.materials[0] = m; tn = [n for n in m.node_tree.nodes if n.type == 'TEX_IMAGE'][0]
        def cw_pose(k): tn.image = imgs[k]
        amb('chatglow', cw, 8, cw_pose, 0, 4)
    pl = [o for o in sc.objects if o.name.startswith('pottedPlant')]
    while pl and pl[0].parent is not None: pl = [pl[0].parent]
    if pl:
        root = pl[0]; kids = [c for c in [root] + list(root.children_recursive) if c.type == 'MESH']; r0 = root.rotation_euler.copy()
        def pl_pose(k, N=12): root.rotation_euler = (r0.x + R(2.2)*math.sin(2*math.pi*k/N), r0.y + R(1.4)*math.cos(2*math.pi*k/N), r0.z)
        amb('plant', kids, 12, pl_pose, 320, 6)
    lost_line(548, 646, base_y=646)

for _k, _f in (('R7_office', L_office), ('R7_hub', L_hub), ('R7_corridor_dark', L_corridor), ('R7_corridor_lit', L_corridor),
               ('R7_archive_H', L_archive), ('R7_archive_L', L_archive), ('R7_arena', L_arena), ('R7_message', L_message)):
    _p = ROOMS6.get(_k, ROOMS6.get('R7_hub'))
    ROOMS6[_k] = (lambda p, f: (lambda: (p(), f())))(_p, _f)
ROOMS6['R7_hub_shut'] = ROOMS6['R7_hub_open'] = ROOMS6['R7_hub']
