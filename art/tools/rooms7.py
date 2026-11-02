# art-v7: the six Phase 1 rooms built in SCREEN space so they line up 1:1 with the game layout
# (game/src/rooms.ts, 1280x720). Every placement is a screen point + height; unproj() turns it into a world
# point for the v6 camera (ortho 8.4, pitch 38, yaw -30). Clean plates only: no actors, no word tiles, no sign text.
# Foreground pieces get pass index 30+k and are logged in EXTRA_LOG['fg'] with their screen base y (depth sort in game).
# State variants via env STATE: corridor dark|lit, archive HU|HD|LU|LD (water High/Low, bridge Up/Down).
import bmesh
STATE = os.environ.get('STATE', '')
O7 = 8.4; T7 = R(90 - 38); Y7 = R(30)
RIGHT = Vector((math.cos(Y7), math.sin(Y7), 0)); UP = Vector((-math.sin(Y7)*math.cos(T7), math.cos(Y7)*math.cos(T7), math.sin(T7)))
PXZ = UP.z*1280/O7            # screen px per world unit of height (~120)
def unproj(sx, sy, z=0.0):
    u = (sx - 640)*O7/1280; v = (360 - sy)*O7/1280; dz = z - 0.5
    a, b, c, d = RIGHT.x, RIGHT.y, UP.x, UP.y; r1 = u - RIGHT.z*dz; r2 = v - UP.z*dz; det = a*d - b*c
    return Vector(((r1*d - b*r2)/det, (a*r2 - c*r1)/det, z))
def zpx(px): return px/PXZ
FG = []
def fg(objs, base_y, name):
    i = 30 + len(FG); FG.append(dict(idx=i, base_y=base_y, name=name))
    for o in objs:
        for c in [o] + list(o.children_recursive):
            if c.type in ('MESH', 'CURVE'): c.pass_index = i
    EXTRA_LOG['fg'] = FG
def meshes_of(e):
    return [bpy.data.objects[n] for n in e['meshes']] if isinstance(e, dict) else [e]
def quad(name, pts, mat, index=IDX['env'], tile=1.2, solid=0.0):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); vs = [bm.verts.new(p) for p in pts]; f = bm.faces.new(vs)
    uv = bm.loops.layers.uv.new()
    for l in f.loops: l[uv].uv = (l.vert.co.x/tile, l.vert.co.y/tile)
    bm.normal_update()
    if f.normal.z < 0: f.normal_flip()
    bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); o.data.materials.append(mat); o.pass_index = index
    if solid: md = o.modifiers.new('s', 'SOLIDIFY'); md.thickness = solid; md.offset = -1
    return o
def floor_rect(x, y, w, h, mat, z=0.0, solid=0.35, tile=1.2):
    return quad('floor', [unproj(x, y+h, z), unproj(x+w, y+h, z), unproj(x+w, y, z), unproj(x, y, z)], mat, tile=tile, solid=solid)
def away(sx, sy):
    a = unproj(sx, sy); b = unproj(sx, sy - 10); return (b - a).normalized()
def wall_seg(sx0, sx1, syf, hpx, mat, th=0.22, z0=0.0, index=IDX['env']):
    A = unproj(sx0, syf, z0); B = unproj(sx1, syf, z0); d = B - A; n = away(sx0, syf); h = zpx(hpx)
    c = (A + B)/2 + n*th/2; c.z = z0 + h/2
    o = box('wall', (d.length, th, h), c, mat, index=index); o.rotation_euler = (0, 0, math.atan2(d.y, d.x)); return o
def on_wall(sx0, sx1, sy_top, sy_bot, syf, mat, eps=0.012, name='wallpanel'):
    """a flat panel on the front face of a wall whose floor line is at screen y syf (window, screen, board)"""
    A = unproj(sx0, syf); B = unproj(sx1, syf); d = B - A; n = away(sx0, syf)
    z0 = zpx(syf - sy_bot); z1 = zpx(syf - sy_top); c = (A + B)/2 - n*eps; c.z = (z0 + z1)/2
    o = plane(name, d.length, z1 - z0, mat, c, rot=(R(90), 0, math.atan2(d.y, d.x))); return o
def kp(name, sx, sy, rz=0, s=1.0, z=0.0, val=None, sat=None):
    p = unproj(sx, sy, z); return cprop(name, p.x, p.y, SCR_RZ + rz, s=s, z=z, val=val, sat=sat)
def post_at(sx, syf, hpx, mat, w=0.07):
    p = unproj(sx, syf); h = zpx(hpx); return box('post', (w, w, h), (p.x, p.y, h/2), mat, rot=(0, 0, R(SCR_RZ)))
def bar_between(sx0, sx1, syf, hz, mat, t=0.04):
    A = unproj(sx0, syf, hz); B = unproj(sx1, syf, hz); d = B - A; o = box('bar', (d.length, t, t), (A + B)/2, mat); o.rotation_euler = (0, 0, math.atan2(d.y, d.x)); return o
def L_at(kind, sx, syf, z, energy, col, size=0.5, spot=None, blend=0.8, aim_to=None):
    p = unproj(sx, syf, 0); l = light(kind, (p.x, p.y, z), energy, col, size, spot=spot, blend=blend)
    if kind in ('SPOT', 'AREA'): aim(l, aim_to if aim_to is not None else (p.x, p.y, 0))
    return l
def floor_mat(name, tex='floor_calm.png', tint=(1, 1, 1), rough=0.45, grid=None):
    m = img_mat(name, TX5+tex, rough=rough); nt = m.node_tree; b = nt.nodes['Principled BSDF']; t = [n for n in nt.nodes if n.type == 'TEX_IMAGE'][0]
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs[0].default_value = 1.0
    nt.links.new(t.outputs['Color'], mix.inputs[6]); mix.inputs[7].default_value = (*L3(tint), 1); nt.links.new(mix.outputs[2], b.inputs['Base Color'])
    if grid:   # faint emissive grid lines (mirror hub)
        br = nt.nodes.new('ShaderNodeTexBrick'); br.offset = 0.0; br.inputs['Scale'].default_value = 0.7; br.inputs['Mortar Size'].default_value = 0.008
        br.inputs['Color1'].default_value = (0, 0, 0, 1); br.inputs['Color2'].default_value = (0, 0, 0, 1); br.inputs['Mortar'].default_value = (1, 1, 1, 1)
        mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = globals().get('GRIDK', 0.045); nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.6; nt.links.new(tc.outputs['UV'] if False else nt.nodes.new('ShaderNodeTexCoord').outputs['UV'], nz.inputs['Vector'])
        rp = nt.nodes.new('ShaderNodeMapRange'); rp.inputs[1].default_value = 0.42; rp.inputs[2].default_value = 0.62; nt.links.new(nz.outputs['Fac'], rp.inputs[0])
        m2 = nt.nodes.new('ShaderNodeMath'); m2.operation = 'MULTIPLY'; nt.links.new(br.outputs['Fac'], m2.inputs[0]); nt.links.new(rp.outputs[0], m2.inputs[1]); nt.links.new(m2.outputs[0], mul.inputs[0]); nt.links.new(mul.outputs[0], b.inputs['Emission Strength']); b.inputs['Emission Color'].default_value = (*L3(grid), 1)
        tc = nt.nodes.new('ShaderNodeTexCoord'); nt.links.new(tc.outputs['UV'], br.inputs['Vector'])
    return m
def paper_bits(cx, cy, rx, ry, n, seed=3, z=0.003):
    rnd = random.Random(seed); pm = srgb('paper', (206, 204, 196), rough=0.8); out = []
    for i in range(n):
        a = rnd.random()*6.283; r = math.sqrt(rnd.random()); sx = cx + math.cos(a)*rx*r; sy = cy + math.sin(a)*ry*r
        p = unproj(sx, sy, z)
        if rnd.random() < 0.25:
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=rnd.uniform(0.04, 0.07), location=(p.x, p.y, 0.04)); o = bpy.context.object
            o.data.materials.append(pm); o.rotation_euler = (rnd.random()*3, rnd.random()*3, rnd.random()*3)
        else:
            o = plane('sheet', rnd.uniform(0.12, 0.2), rnd.uniform(0.16, 0.26), pm, (p.x, p.y, z + i*0.0004), rot=(R(rnd.uniform(-4, 4)), 0, rnd.random()*6.283))
        o.pass_index = IDX['env']; out.append(o)
    return out
def rain_streaks(sx0, sx1, sy0, sy1, syf, n=60, seed=5):
    rnd = random.Random(seed); m = emit_mat('rain', (150, 190, 220), 0.35); n_ = away(sx0, syf)
    for i in range(n):
        sx = rnd.uniform(sx0+6, sx1-6); syt = rnd.uniform(sy0+4, sy1-24); L = rnd.uniform(8, 22)
        A = unproj(sx, syf); z1 = zpx(syf - syt); p = A - n_*0.03; p.z = z1 - zpx(L)/2
        plane('streak', 0.0035, zpx(L), m, p, rot=(R(90), R(rnd.uniform(-6, -2)), math.atan2(RIGHT.y, RIGHT.x)))
def glow_edge(sx0, sx1, syf, col, strength=1.2, z=0.01):
    return bar_between(sx0, sx1, syf, z, emit_mat('edge'+str(len(bpy.data.materials)), col, strength), t=0.018)

WALL = (28, 46, 62); TRIM = (16, 28, 40)
def calm_base(amb=(0.28, 0.42, 0.62), amb_e=45):
    world(); base_lights(amb=amb, amb_e=amb_e)

# ================= 1. REAL OFFICE (11:48 PM, rain) =================
TX7 = T5 + '../tex/'
def cable(pts, r=0.009, col=(14, 16, 20)):
    cu = bpy.data.curves.new('cable', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r; cu.bevel_resolution = 2
    sp = cu.splines.new('NURBS'); sp.points.add(len(pts) - 1); sp.use_endpoint_u = True; sp.order_u = 3
    for k, pt in enumerate(pts):
        sx, sy = pt[:2]; z = pt[2] if len(pt) > 2 else 0.008; q = unproj(sx, sy, z); sp.points[k].co = (q.x, q.y, q.z, 1)
    o = bpy.data.objects.new('cable', cu); sc.collection.objects.link(o); o.data.materials.append(srgb('cablem', col, rough=0.5)); o.pass_index = IDX['env']; return o
def bevel_all(minp=6):
    for o in list(sc.objects):
        if o.type == 'MESH' and len(o.data.polygons) >= minp and not any(m.type == 'BEVEL' for m in o.modifiers):
            m = o.modifiers.new('bv', 'BEVEL'); m.width = 0.006; m.segments = 2; m.limit_method = 'ANGLE'
def paper_stack(sx, sy, z, n=6, seed=1, rz=0):
    rnd = random.Random(seed); pm = srgb('pstack', (220, 216, 204), rough=0.85); out = []
    for k in range(n):
        q = unproj(sx + rnd.uniform(-2, 2), sy + rnd.uniform(-1, 1), z)
        out.append(box('sheet', (0.21, 0.28, 0.004), (q.x, q.y, z + 0.002 + k*0.005), pm, rot=(0, 0, R(SCR_RZ + rz + rnd.uniform(-8, 8)))))
    return out
def cyl(sx, sy, z, r, h, mat, rot=(0, 0, 0)):
    q = unproj(sx, sy, z); bpy.ops.mesh.primitive_cylinder_add(vertices=18, radius=r, depth=h, location=(q.x, q.y, z + h/2), rotation=rot); o = bpy.context.object; o.data.materials.append(mat); return o
def P_office():
    calm_base(amb_e=36)
    fm = floor_mat('ofloor', tint=(150, 160, 170), rough=0.42); wm = srgb('owall', (40, 50, 60), rough=0.9); tm = srgb('otrim', (22, 28, 36))
    floor_rect(70, 200, 1140, 480, fm)
    wall_seg(70, 1210, 200, 150, wm); wall_seg(70, 1210, 200, 8, tm, th=0.24)
    # carpet tiles: two worn runs where people actually walked
    # rain window + rain light thrown across the floor
    on_wall(760, 1160, 72, 186, 200, img_mat('osky', TX5+'window_sky.png', emit=0.55), name='window')
    fr = srgb('wframe', (14, 20, 28), rough=0.5)
    for x in (760, 893, 1027, 1160): on_wall(x-3, x+3, 70, 188, 200, fr, eps=0.02, name='mullion')
    on_wall(756, 1164, 186, 192, 200, srgb('sill', (52, 62, 72)), eps=0.03, name='sill')
    # (art-v8: the rain is an ambient loop now, rooms8.py)
    rp = unproj(930, 290); floor_decal('rainlight', TX7+'rain_light.png', rp.x, rp.y, 3.6, 1.5, rz=SCR_RZ - 14, emit=0.22)
    L_at('AREA', 960, 260, 1.4, 60, (0.50, 0.66, 0.90), 2.5, aim_to=tuple(unproj(960, 420)))
    # back wall, west to east: lift, printer corner, kitchenette, bookcase, whiteboard, coat rack
    on_wall(150, 260, 80, 200, 200, srgb('lift', (58, 66, 74), rough=0.3, metal=0.7), name='lift')
    on_wall(203, 207, 80, 200, 200, srgb('liftgap', (10, 12, 16)), eps=0.02)
    on_wall(266, 274, 120, 136, 200, emit_mat('liftbtn', (246, 198, 132), 1.5), eps=0.02)
    kc = kp('kitchenCabinet', 330, 205, s=0.9, val=0.45); kp('kitchenCoffeeMachine', 318, 200, s=0.9, z=kc['size'][2])
    kp('kitchenMicrowave', 350, 200, s=0.7, z=kc['size'][2], val=0.5)
    kp('bookcaseClosedWide', 450, 205, s=0.9, val=0.45)
    for k, (sx, z) in enumerate(((430, 0.42), (460, 0.42), (440, 0.80))): kp('books', sx, 200, s=0.8, z=z, val=0.6, sat=0.5)
    on_wall(540, 700, 96, 170, 200, img_mat('wboard', TX7+'whiteboard.png', emit=0.06, rough=0.25), eps=0.025, name='whiteboard')
    on_wall(536, 704, 168, 174, 200, srgb('wbtray', (120, 126, 132), metal=0.6), eps=0.04)
    kp('coatRackStanding', 730, 210, s=0.9, val=0.5)
    # printer on a side table by the lift, a jammed sheet still sticking out
    pt = kp('sideTableDrawers', 120, 232, s=0.9, val=0.45); pz = pt['size'][2]; pq = unproj(120, 228, pz)
    box('printer', (0.42, 0.34, 0.2), (pq.x, pq.y, pz + 0.1), srgb('printer', (196, 198, 196), rough=0.4), rot=(0, 0, R(SCR_RZ)))
    box('ptray', (0.36, 0.12, 0.02), (pq.x, pq.y, pz + 0.205), srgb('ptray', (60, 64, 70)), rot=(0, 0, R(SCR_RZ)))
    jam = plane('jam', 0.2, 0.16, srgb('jam', (232, 228, 218), rough=0.8), (pq.x, pq.y, pz + 0.27), rot=(R(75), 0, R(SCR_RZ)))
    paper_stack(160, 262, 0.0, 9, seed=3)
    # Dez's desk: glowing, a small plant and a pen cup, chair pushed back like he'll be right back
    global MON_TEX, MON_EMIT
    MON_TEX = TX+'monC_chat.png'; MON_EMIT = 0.9
    dz = kp('desk', 395, 420, s=0.9, val=0.42); dh = dz['size'][2]; m1 = kp('computerScreen', 380, 400, s=0.9, z=dh); screen_on(m1, TX+'monC_chat.png', 0.9)
    ch = kp('chairDesk', 410, 462, 165, s=0.85, val=0.5, sat=0.3)
    c1 = [kp('plantSmall3', 440, 410, s=0.9, z=dh), kp('computerKeyboard', 392, 418, s=0.9, z=dh), cyl(355, 418, dh, 0.03, 0.08, srgb('pencup', (60, 90, 130)))]
    c1 += paper_stack(430, 428, dh, 4, seed=5)
    # Kabir's desk: glowing, headphones, a sticky note on the monitor edge
    kz = kp('desk', 685, 300, s=0.9, val=0.42); m2 = kp('computerScreen', 668, 280, s=0.9, z=dh); screen_on(m2, TX+'monA_chart.png', 0.8)
    kp('chairDesk', 685, 334, 175, s=0.85, val=0.5, sat=0.3)
    hq = unproj(725, 296, dh + 0.03); bpy.ops.mesh.primitive_torus_add(major_radius=0.07, minor_radius=0.012, location=hq, rotation=(R(90), 0, R(SCR_RZ))); hp = bpy.context.object; hp.data.materials.append(srgb('phones', (30, 30, 34), rough=0.3))
    sn = unproj(650, 282, dh + 0.18); stk = plane('sticky', 0.06, 0.06, srgb('stk', (240, 214, 90), rough=0.8), (sn.x, sn.y, dh + 0.18), rot=(R(90), 0, R(SCR_RZ)))
    c2 = [hp, stk, kp('computerMouse', 705, 302, s=1.0, z=dh)]
    # Noor's desk: dust grey, cleared. One thing left: her tiny potted fern, still alive under the lamp
    nz = kp('desk', 990, 490, s=0.9, val=0.30, sat=0.15); m3 = kp('computerScreen', 975, 470, s=0.9, z=dh, val=0.3, sat=0.1)
    screen_on(m3, TX+'monC_chat.png', 0.0).data.materials[0] = srgb('dead', (8, 10, 12), rough=0.3)
    lmp = kp('lampSquareTable', 1040, 478, s=0.8, z=dh); p = unproj(1040, 478); lamp_glow(p.x, p.y, 0.62, 9)
    fern = kp('plantSmall1', 1005, 488, s=0.75, z=dh, sat=1.1)
    L_at('SPOT', 1005, 495, 1.6, 140, (1.0, 0.72, 0.46), 0.25, spot=28, blend=0.6)
    kp('cardboardBoxClosed', 1100, 530, 20, s=1.1, val=0.5); kp('cardboardBoxOpen', 1135, 560, -10, s=0.9, val=0.45)
    # a coworker's desk with the mug (COLD SINCE AUGUST), a framed photo turned face-down
    cz = kp('desk', 235, 590, s=0.85, val=0.42); kp('chairDesk', 235, 622, 190, s=0.8, val=0.5, sat=0.3)
    mp = unproj(233, 568, 0.33); bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.045, depth=0.09, location=(mp.x, mp.y, 0.375))
    mug = bpy.context.object; mug.data.materials.append(srgb('mug', (210, 200, 186), rough=0.4))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.028, minor_radius=0.008, location=(mp.x + 0.05, mp.y, 0.38), rotation=(R(90), 0, R(SCR_RZ))); handle = bpy.context.object; handle.data.materials.append(mug.data.materials[0])
    phq = unproj(262, 582, dh); photo = box('photo', (0.14, 0.1, 0.012), (phq.x, phq.y, dh + 0.008), srgb('photo', (70, 50, 40), rough=0.5), rot=(0, 0, R(SCR_RZ + 12)))
    # empty pods with their chairs tucked in, keyboards squared away
    for sx, sy in ((165, 330), (1140, 350)):
        d_ = kp('desk', sx, sy, s=0.85, val=0.32, sat=0.2); kp('chairDesk', sx, sy + 32, 185, s=0.8, val=0.4, sat=0.2); kp('computerKeyboard', sx, sy - 6, s=0.9, z=d_['size'][2])
    # the meeting nook nobody books any more: round table, two chairs, a laptop left closed
    nt_ = kp('tableRound', 600, 625, s=0.9, val=0.42); kp('chair', 555, 630, 80, s=0.85, val=0.45); kp('chair', 648, 615, -100, s=0.85, val=0.45)
    kp('laptop', 600, 620, 20, s=0.9, z=nt_['size'][2], val=0.4); paper_stack(615, 630, nt_['size'][2], 3, seed=9)
    # cable runs: every desk to a floor box, taped down
    met = (18, 20, 24)
    cable([(395, 430), (420, 470), (520, 500), (700, 505), (860, 515), (930, 512)]); cable([(685, 312), (700, 360), (760, 420), (900, 470)])
    cable([(235, 600), (300, 560), (420, 545), (600, 540), (900, 520)]); cable([(165, 340), (200, 300), (230, 240), (250, 202, 0.02)])
    for sx, sy in ((900, 470), (930, 512)): floor_rect(sx - 10, sy - 6, 20, 12, srgb('fbox', (60, 66, 72), metal=0.5), z=0.004, solid=0.01)
    kp('pottedPlant', 96, 215, s=1.2); kp('plantSmall2', 1180, 215, s=1.5); kp('trashcan', 470, 450, s=1.0, val=0.45)
    paper_bits(480, 470, 22, 8, 3, seed=11); kp('lampSquareFloor', 1185, 470, s=0.9, val=0.5)
    fp = kp('pottedPlant', 1190, 690, s=1.8, val=0.4)
    L_at('SPOT', 640, 430, 3.2, 380, (1.0, 0.74, 0.50), 0.8, spot=60, blend=1.0)
    L_at('SPOT', 395, 430, 2.8, 120, (1.0, 0.74, 0.50), 0.6, spot=50, blend=1.0); L_at('SPOT', 685, 310, 2.8, 100, (1.0, 0.74, 0.50), 0.6, spot=50, blend=1.0)
    L_at('SPOT', 620, 160, 2.6, 60, (0.9, 0.95, 1.0), 0.5, spot=45, blend=1.0, aim_to=tuple(unproj(620, 200, 0.6)))
    L_at('AREA', 395, 400, 0.9, 6, (0.45, 0.85, 0.95), 0.5); L_at('AREA', 685, 280, 0.9, 6, (0.55, 0.7, 1.0), 0.5)
    bevel_all()
    fg(meshes_of(dz) + meshes_of(m1) + meshes_of(ch) + [o for e in c1 for o in meshes_of(e)], 450, 'dez_desk'); fg(meshes_of(kz) + meshes_of(m2) + [o for e in c2 for o in meshes_of(e)], 330, 'kabir_desk')
    fg(meshes_of(nz) + meshes_of(m3) + meshes_of(lmp) + meshes_of(fern), 515, 'noor_desk'); fg(meshes_of(cz) + [mug, handle, photo], 615, 'mug_desk'); fg(meshes_of(fp), 720, 'fg_plant')
    fg(meshes_of(nt_), 645, 'nook')

# ================= 2. MIRROR HUB (iconic home base) =================
def P_hub():
    calm_base(amb=(0.22, 0.32, 0.62), amb_e=30)
    global GRIDK; GRIDK = 0.02          # art-v8 calm pass: the grid is a whisper, not a pattern
    fm = floor_mat('hfloor', tint=(90, 110, 150), rough=0.16, grid=(80, 200, 220)); wm = srgb('hwall', (22, 30, 58), rough=0.85); tm = srgb('htrim', (12, 18, 36))
    for (y0, y1) in ((150, 254), (318, 680)): floor_rect(80, y0, 1120, y1 - y0, fm)
    wall_seg(80, 1200, 150, 140, wm)
    # the exit door north (iconic arch: dark void + cyan rim)
    on_wall(586, 694, 52, 150, 150, srgb('exvoid', (3, 6, 12)), name='exitvoid')
    neon = emit_mat('hneon', (120, 228, 232), 2.2)
    for x0, x1 in ((580, 586), (694, 700)): on_wall(x0, x1, 46, 150, 150, neon, eps=0.02)
    on_wall(580, 700, 40, 46, 150, neon, eps=0.02)
    L_at('AREA', 640, 160, 0.8, 9, (0.47, 0.89, 0.91), 0.6, aim_to=tuple(unproj(640, 220)))
    # a dim neon strip along the whole back wall (the one accent) + mirrored ghost desks at the far corners
    on_wall(80, 1200, 128, 131, 150, emit_mat('strip', (90, 150, 230), 0.3), eps=0.02)
    TX7 = T5 + '../tex/'
    # art-v8 calm pass: the mirrored ghost desks are gone (they competed with the door); one quiet coat rack stands in for the office
    kp('coatRackStanding', 1150, 205, s=0.9, val=0.35, sat=0.3)
    # the mirror: a tall pane on the back wall; the clock beside it runs the wrong way
    on_wall(214, 412, 34, 146, 150, srgb('mframe', (30, 38, 60), metal=0.6, rough=0.3), eps=0.03, name='mframe')
    mir = bpy.data.materials.new('mirror'); mir.use_nodes = True; bb = mir.node_tree.nodes['Principled BSDF']; bb.inputs['Metallic'].default_value = 1.0; bb.inputs['Roughness'].default_value = 0.03; bb.inputs['Base Color'].default_value = (0.75, 0.85, 0.95, 1)
    on_wall(222, 404, 42, 140, 150, mir, eps=0.045, name='mirror')
    cp = unproj(960, 150); n_ = away(960, 150)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.2, depth=0.04, location=(cp.x - n_.x*0.04, cp.y - n_.y*0.04, zpx(150 - 82)), rotation=(R(90), 0, math.atan2(RIGHT.y, RIGHT.x)))
    bpy.context.object.data.materials.append(img_mat('mclock', TX7+'clock_blank.png', emit=0.3))
    HUBCLOCK.update(c=Vector((cp.x - n_.x*0.065, cp.y - n_.y*0.065, zpx(150 - 82))), n=Vector((-n_.x, -n_.y, 0)))
    # the dash gap: no floor, a deep shaft with faint falling glyph motes, cyan rims
    # (the falling glyph motes are an ambient loop now: rooms8.py)
    glow_edge(80, 1200, 254, (120, 228, 232), 1.4); glow_edge(80, 1200, 318, (120, 228, 232), 1.4)
    # rail post + rail beside the gap (GAP IS WIDE hangs here)
    met = srgb('rail', (70, 90, 104), rough=0.35, metal=0.8)
    post_at(304, 366, 44, met, 0.05); post_at(420, 366, 44, met, 0.05); bar_between(304, 420, 366, zpx(44), met, 0.035)
    # partition with the door frame (DOOR IS SHUT is mounted on the door panel, drawn in game)
    pm = srgb('part', (30, 42, 74), rough=0.6)
    parts = []
    for x0, x1 in ((80, 600), (680, 1200)):
        a = unproj(x0, 434); b = unproj(x1, 434); n = away(x0, 434); th = (unproj(x0, 400) - unproj(x0, 434)).length
        c = (a + b)/2 + n*th/2; h = zpx(38); c.z = h/2; o = box('partition', ((b - a).length, th, h), c, pm); o.rotation_euler = (0, 0, math.atan2((b-a).y, (b-a).x)); parts.append(o)
        parts.append(bar_between(x0, x1, 434, h + 0.01, emit_mat('ptop'+str(x0), (90, 150, 230), 0.6), 0.02))
    fm2 = srgb('dframe', (14, 22, 40), rough=0.4, metal=0.5)
    parts += [post_at(600, 434, 124, fm2, 0.08), post_at(680, 434, 124, fm2, 0.08), bar_between(600, 680, 434, zpx(124), fm2, 0.08)]
    # the real door panel: frosted coral glass in a thin frame, a cold handle (its own fg layer: the game hides it when OPEN)
    gl = bpy.data.materials.new('doorglass'); gl.use_nodes = True; gb = gl.node_tree.nodes['Principled BSDF']
    gb.inputs['Base Color'].default_value = (*L3((200, 96, 88)), 1); gb.inputs['Roughness'].default_value = 0.35; gb.inputs['Transmission Weight'].default_value = 0.6
    gb.inputs['Emission Color'].default_value = (*L3((240, 128, 116)), 1); gb.inputs['Emission Strength'].default_value = 0.35
    da = unproj(604, 434); db = unproj(676, 434); dd = db - da; dn = away(604, 434); thd = (unproj(604, 400) - unproj(604, 434)).length
    dc = (da + db)/2 + dn*thd*0.5; dc.z = zpx(120)/2
    dpan = box('doorpanel', (dd.length, 0.05, zpx(120)), dc, gl); dpan.rotation_euler = (0, 0, math.atan2(dd.y, dd.x))
    dfr = srgb('dpframe', (26, 34, 52), metal=0.6, rough=0.3); dparts = [dpan]
    for zz in (0.02, zpx(120) - 0.02): o_ = box('dpf', (dd.length, 0.07, 0.035), Vector((dc.x, dc.y, zz)), dfr); o_.rotation_euler = dpan.rotation_euler.copy(); dparts.append(o_)
    hq = unproj(664, 434, zpx(60)); o_ = box('handle', (0.03, 0.09, 0.16), (hq.x - dn.x*0.05, hq.y - dn.y*0.05, zpx(60)), srgb('dhandle', (150, 160, 170), metal=0.9, rough=0.2)); o_.rotation_euler = dpan.rotation_euler.copy(); dparts.append(o_)
    if STATE != 'open':   # the coral door light (and its floor reflection) exists only while the door is SHUT
        L_at('AREA', 640, 470, 0.6, 14, (0.94, 0.5, 0.45), 0.6, aim_to=tuple(unproj(640, 420, 0.4)))
        L_at('SPOT', 640, 436, 2.6, 26, (0.94, 0.52, 0.46), 0.3, spot=28, blend=1.0)   # focal: a narrow coral wash on the door itself
    else:                 # open: cool air through the empty frame
        L_at('AREA', 640, 420, 0.5, 7, (0.47, 0.89, 0.91), 0.5, aim_to=tuple(unproj(640, 470, 0.0)))
    if STATE == 'open':
        for o_ in dparts: o_.hide_render = True
    # lamp on a side table (LAMP IS OPEN label on its housing)
    st = kp('sideTable', 260, 505, s=0.9, val=0.4); lp = kp('lampSquareTable', 260, 495, s=1.0, z=0.36); p = unproj(260, 495); lamp_glow(p.x, p.y, 0.7, 10)
    # Fern's desk (Fern herself is a sprite), a warm pool on it
    fd = kp('desk', 1005, 560, s=0.95, val=0.35); kp('chairDesk', 1005, 596, 175, s=0.9, val=0.45, sat=0.3)
    L_at('SPOT', 1005, 560, 2.2, 90, (0.89, 0.48, 0.85), 0.4, spot=45)
    # floor emblem in the south zone (the hub's sigil) + warm home pool
    # (art-v8: the floor dial emblem is gone; the door is the only sigil)
    L_at('SPOT', 640, 560, 3.4, 420, (1.0, 0.72, 0.46), 0.6, spot=55, blend=0.9)
    L_at('SPOT', 640, 220, 3.0, 70, (0.47, 0.75, 0.95), 0.6, spot=70, blend=1.0)
    fp = kp('pottedPlant', 100, 690, s=1.8, val=0.35)
    fg(dparts, 435, 'door_panel'); fg(parts, 434, 'partition'); fg(meshes_of(st) + meshes_of(lp), 512, 'lamp'); fg(meshes_of(fd), 590, 'fern_desk'); fg(meshes_of(fp), 720, 'fg_plant')

# ================= 3. DARK CORRIDOR (dark | lit) =================
def P_corridor():
    lit = STATE == 'lit'
    world(0.4 if not lit else 1.0); base_lights(amb=(0.20, 0.28, 0.50), amb_e=10 if not lit else 26)
    fm = floor_mat('cfloor', tint=(90, 100, 120), rough=0.35); wm = srgb('cwall', (24, 32, 48), rough=0.9)
    for (x, y, w, h) in ((60, 330, 960, 140), (140, 230, 130, 100), (1000, 220, 220, 400)): floor_rect(x, y, w, h, fm)
    wall_seg(60, 140, 330, 100, wm); wall_seg(270, 1000, 330, 100, wm); wall_seg(140, 270, 230, 70, wm); wall_seg(1000, 1220, 220, 110, wm)
    jm = srgb('jamb', (18, 24, 38))
    for sx, y0, y1 in ((140, 230, 330), (270, 230, 330)):
        post_at(sx, y1, 100, jm, 0.06)
    # switch housing in the niche (SWITCH IS ..), with a tiny LED
    on_wall(190, 220, 192, 218, 230, srgb('swbox', (52, 62, 76), rough=0.4, metal=0.5), eps=0.03, name='switch')
    on_wall(203, 207, 198, 202, 230, emit_mat('led', (120, 228, 232) if lit else (240, 128, 116), 3.0), eps=0.04)
    # ceiling lamp on a wall bracket (LIGHT IS ..)
    on_wall(356, 364, 262, 300, 330, srgb('arm', (60, 66, 76), metal=0.7), eps=0.03, name='lamparm')
    lp = unproj(360, 330); n = away(360, 330); hz = zpx(330 - 258)
    bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=0.16, radius2=0.05, depth=0.12, location=(lp.x - n.x*0.18, lp.y - n.y*0.18, hz)); sh = bpy.context.object
    sh.data.materials.append(srgb('shade', (40, 44, 52), rough=0.4, metal=0.5))
    bpy.ops.mesh.primitive_circle_add(vertices=20, radius=0.15, fill_type='NGON', location=(lp.x - n.x*0.18, lp.y - n.y*0.18, hz - 0.06))
    bpy.context.object.data.materials.append(emit_mat('bulbc', (255, 210, 150), 4.0 if lit else 0.05))
    # Fern's sticky note on the wall + the wall clock in the alcove
    on_wall(845, 875, 290, 312, 330, img_mat('fnote', TX6+'sticky_49.png', emit=0.3 if lit else 0.02), eps=0.02, name='note')
    cp = unproj(1110, 220); n = away(1110, 220); cz = zpx(220 - 165)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.16, depth=0.04, location=(cp.x - n.x*0.03, cp.y - n.y*0.03, cz), rotation=(R(90), 0, math.atan2(RIGHT.y, RIGHT.x)))
    bpy.context.object.data.materials.append(img_mat('clockf', TX6+'clock_0312.png', emit=0.25 if lit else 0.03))
    # the dummy alcove: a training mat + a coat rack of paper + exit door frame on the east
    kp('rugRectangle', 1110, 480, 90, s=1.0, val=0.22, sat=0.2)
    dm = srgb('edoor', (20, 30, 46), metal=0.4)
    door = [post_at(1214, 360, 120, dm, 0.06), post_at(1214, 480, 120, dm, 0.06)]
    for sx in (1040, 1180):
        kp('cardboardBoxOpen', sx, 610, 15, s=1.0, val=0.4)
    # path tiles beyond the dark (glow only when lit)
    # art-v8: the old cyan path tiles are gone; the lit state guides with light pools only
    if lit:
        L_at('SPOT', 360, 420, 2.2, 520, (1.0, 0.72, 0.46), 0.3, spot=70, blend=0.9)
        L_at('SPOT', 860, 420, 2.4, 160, (1.0, 0.74, 0.50), 0.5, spot=55, blend=1.0)
        L_at('SPOT', 640, 405, 2.6, 70, (1.0, 0.76, 0.54), 0.6, spot=50, blend=1.0)     # soft stepping-stone pools along the path
        L_at('SPOT', 1000, 400, 2.6, 60, (1.0, 0.76, 0.54), 0.6, spot=45, blend=1.0)
        L_at('SPOT', 1110, 420, 2.8, 260, (0.60, 0.80, 0.95), 0.6, spot=60, blend=1.0)
    else:
        L_at('SPOT', 205, 270, 1.6, 4, (0.5, 0.8, 0.9), 0.3, spot=60)
        L_at('SPOT', 1110, 420, 2.8, 20, (0.45, 0.6, 0.9), 0.6, spot=60, blend=1.0)
    fg(door, 480, 'alcove_door')

# ================= 4. FLOODED ARCHIVE (HU HD LU LD) =================
def P_archive():
    high = STATE[:1] != 'L'
    calm_base(amb=(0.24, 0.38, 0.60), amb_e=40)
    down = False
    fm = floor_mat('afloor', tint=(120, 140, 150), rough=0.5); wm = srgb('awall', (30, 48, 66), rough=0.9)
    floor_rect(60, 180, 380, 500, fm); floor_rect(840, 180, 380, 500, fm)
    wall_seg(60, 1220, 180, 130, wm)
    # pit: back pit wall (stairwell sign goes here) + sunken floor + stairs down
    pd = 0.95; pw = srgb('pitwall', (20, 32, 44), rough=0.9)
    wall_seg(440, 840, 180, pd*PXZ, pw, th=0.1, z0=-pd)
    pf = floor_mat('pitfloor', tint=(70, 86, 96), rough=0.3)
    quad('pitfloor', [unproj(440, 760, -pd), unproj(840, 760, -pd), unproj(840, 180 + pd*PXZ, -pd), unproj(440, 180 + pd*PXZ, -pd)], pf)
    for sx in (440, 840):   # pit side faces (thin, nearly edge-on)
        a = unproj(sx, 180); b = unproj(sx, 680); d = b - a; o = box('pitside', (0.05, d.length, pd), ((a + b)/2 + Vector((0, 0, -pd/2))), pw); o.rotation_euler = (0, 0, math.atan2(d.y, d.x) - R(90))
    sp = unproj(560, 300, -pd); st = cprop('stairs', sp.x, sp.y, SCR_RZ + 180, s=0.7, z=-pd, val=0.5)
    on_wall(525, 595, 196, 206, 180, srgb('bracket', (60, 70, 80), metal=0.6), eps=0.03, name='bracket')
    if high:
        wmat = bpy.data.materials.new('water'); wmat.use_nodes = True; b = wmat.node_tree.nodes['Principled BSDF']
        b.inputs['Base Color'].default_value = (*L3((18, 60, 82)), 1); b.inputs['Roughness'].default_value = 0.06
        b.inputs['Emission Color'].default_value = (*L3((30, 90, 120)), 1); b.inputs['Emission Strength'].default_value = 0.25
        quad('water', [unproj(440, 680, -0.12), unproj(840, 680, -0.12), unproj(840, 180, -0.12), unproj(440, 180, -0.12)], wmat)
        rnd = random.Random(4); rm = emit_mat('ripple', (150, 210, 230), 0.4)
        for i in range(7):
            p = unproj(rnd.uniform(480, 800), rnd.uniform(230, 640), -0.115); bpy.ops.mesh.primitive_torus_add(major_radius=rnd.uniform(0.1, 0.3), minor_radius=0.004, location=p); bpy.context.object.data.materials.append(rm)
    else:
        pud = bpy.data.materials.new('puddle'); pud.use_nodes = True; b = pud.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (*L3((16, 40, 52)), 1); b.inputs['Roughness'].default_value = 0.05
        quad('puddle', [unproj(460, 700, -pd + 0.01), unproj(820, 700, -pd + 0.01), unproj(820, 560, -pd + 0.01), unproj(460, 560, -pd + 0.01)], pud)
    # the bridge: a chunky hinged plank deck with rails + two chains to the winch (rendered as its own frames, BRIDGE_ANGLE)
    wood = srgb('plank', (96, 72, 50), rough=0.7); dark = srgb('plankd', (60, 44, 32), rough=0.8); iron = srgb('iron', (60, 64, 70), metal=0.8, rough=0.4)
    hA = unproj(440, 455); hB = unproj(440, 385); axis = (hB - hA).normalized(); hinge = (hA + hB)/2
    span = (unproj(840, 420) - unproj(440, 420)).length; ux = (unproj(840, 420) - unproj(440, 420)).normalized(); wid = (hB - hA).length
    piv = bpy.data.objects.new('bridge_pivot', None); sc.collection.objects.link(piv); piv.location = hinge
    piv.rotation_mode = 'QUATERNION'
    deck = []
    def part(dims, along, lat, z, mat):
        o_ = box('bdeck', dims, (0, 0, 0), mat); o_.rotation_euler = (0, 0, math.atan2(ux.y, ux.x)); o_.location = hinge + ux*along + axis*lat + Vector((0, 0, z)); deck.append(o_); return o_
    part((span, wid*0.92, 0.12), span/2, 0, -0.06, wood)
    for k in range(9): part((0.06, wid*0.98, 0.03), 0.15 + k*(span - 0.3)/8, 0, 0.012, dark)
    for lat in (-wid/2, wid/2):
        part((span, 0.05, 0.05), span/2, lat, 0.34, dark)
        for k in range(5): part((0.05, 0.05, 0.34), 0.05 + k*(span - 0.1)/4, lat, 0.17, dark)
    for o_ in deck:
        mw = o_.matrix_world.copy(); o_.parent = piv; o_.matrix_parent_inverse = piv.matrix_world.inverted()
    BRIDGE.update(dict(piv=piv, axis=axis, hinge=hinge, ux=ux, span=span, wid=wid, deck=deck, iron=iron, down=down))
    wp = [post_at(428, 382, 56, srgb('winch', (70, 58, 44), rough=0.6), 0.08)]
    cp = unproj(428, 382, zpx(40)); bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.05, depth=0.16, location=cp, rotation=(0, R(90), R(SCR_RZ))); bpy.context.object.data.materials.append(srgb('crank', (120, 120, 126), metal=0.8)); wp.append(bpy.context.object)
    # west bank: water pipe + gauge on the back wall, filing cabinets, the LOW drawer cabinet front-left
    met = srgb('pipe', (70, 84, 92), rough=0.35, metal=0.8)
    on_wall(256, 270, 56, 180, 180, met, eps=0.05, name='pipe')
    gp = unproj(263, 180); n = away(263, 180)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.1, depth=0.04, location=(gp.x - n.x*0.08, gp.y - n.y*0.08, zpx(180 - 117)), rotation=(R(90), 0, math.atan2(RIGHT.y, RIGHT.x)))
    bpy.context.object.data.materials.append(img_mat('gauge', TX6+'dial.png', emit=0.3))
    for sx in (110, 180): kp('kitchenCabinetDrawer', sx, 205, s=1.0, val=0.45, sat=0.3)
    kp('kitchenCabinetDrawer', 1130, 205, s=1.0, val=0.45, sat=0.3)
    dr = kp('cabinetBedDrawer', 100, 660, 0, s=1.1, val=0.5, sat=0.3)
    # east bank: ink bottle on a side table, towel rack, corkboard on an easel, shelf
    itab = kp('sideTable', 975, 214, s=0.8, val=0.4); ip = unproj(975, 200, 0.4)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.05, depth=0.1, location=(ip.x, ip.y, 0.42)); ink = bpy.context.object; ink.data.materials.append(srgb('ink', (12, 14, 30), rough=0.1))
    tr = [post_at(1176, 330, 70, met, 0.03), post_at(1190, 330, 70, met, 0.03)]
    tp = unproj(1183, 330, zpx(48)); towel = plane('towel', 0.14, 0.26, srgb('towel', (200, 196, 180), rough=0.95), (tp.x, tp.y, zpx(48)), rot=(R(90), 0, R(SCR_RZ))); tr.append(towel)
    cb = [post_at(915, 676, 30, wood, 0.03), post_at(985, 676, 30, wood, 0.03)]
    cbp = unproj(950, 676, zpx(32)); cork = plane('cork', 0.7, 0.24, srgb('cork', (150, 110, 70), rough=0.95), (cbp.x, cbp.y, zpx(32)), rot=(R(70), 0, R(SCR_RZ))); cb.append(cork)
    sh = kp('bookcaseClosed', 1175, 668, s=0.85, val=0.45)
    # lights: warm pools on both banks, cool over the pit
    L_at('SPOT', 250, 430, 3.0, 520, (1.0, 0.72, 0.46), 0.6, spot=60, blend=0.9)
    L_at('SPOT', 1030, 430, 3.0, 520, (1.0, 0.72, 0.46), 0.6, spot=60, blend=0.9)
    L_at('SPOT', 640, 430, 3.2, 200, (0.45, 0.70, 0.95), 0.8, spot=60, blend=1.0)
    L_at('AREA', 1214, 425, 1.0, 20, (0.47, 0.89, 0.91), 0.6)
    ex = [post_at(1214, 380, 120, srgb('exd', (20, 30, 46), metal=0.4), 0.06), post_at(1214, 470, 120, srgb('exd2', (20, 30, 46), metal=0.4), 0.06)]
    fg(wp, 382, 'winch'); fg(meshes_of(dr), 670, 'drawer'); fg(cb, 676, 'corkboard'); fg(meshes_of(sh), 670, 'shelf'); fg(tr, 330, 'towel'); fg(ex, 470, 'exit')

# ================= 5. DRAFT ARENA =================
def P_arena():
    world(0.5); base_lights(amb=(0.22, 0.30, 0.52), amb_e=22)
    fm = floor_mat('rfloor', tint=(100, 110, 124), rough=0.4)
    pts = [unproj(640 + math.cos(a)*320, 420 + math.sin(a)*300) for a in [i*6.283/64 for i in range(64)]]
    me = bpy.data.meshes.new('disc'); bm = bmesh.new(); vs = [bm.verts.new(p) for p in pts]; f = bm.faces.new(vs); uv = bm.loops.layers.uv.new()
    for l in f.loops: l[uv].uv = (l.vert.co.x/1.2, l.vert.co.y/1.2)
    bm.normal_update()
    if f.normal.z < 0: f.normal_flip()
    bm.to_mesh(me); bm.free(); o = bpy.data.objects.new('disc', me); sc.collection.objects.link(o); o.data.materials.append(fm); o.pass_index = IDX['env']
    md = o.modifiers.new('s', 'SOLIDIFY'); md.thickness = 0.35; md.offset = -1
    rim = emit_mat('rim', (120, 228, 232), 0.7)
    for i in range(64):
        a = unproj(640 + math.cos(i*6.283/64)*320, 420 + math.sin(i*6.283/64)*300); b = unproj(640 + math.cos((i+1)*6.283/64)*320, 420 + math.sin((i+1)*6.283/64)*300); d = b - a
        e = box('rim', (d.length, 0.02, 0.02), (a + b)/2, rim); e.rotation_euler = (0, 0, math.atan2(d.y, d.x))
    paper_bits(640, 430, 300, 260, 70)
    # exit door (north) and the WEAK pillar at the edge; a bin of crumpled drafts outside the ring
    dm = srgb('rdoor', (16, 24, 40), metal=0.5)
    door = [post_at(592, 152, 92, dm, 0.08), post_at(688, 152, 92, dm, 0.08), bar_between(592, 688, 152, zpx(92), dm, 0.08)]
    a = unproj(596, 152); b = unproj(684, 152); d = b - a
    pl = plane('void', d.length, zpx(88), srgb('rvoid', (3, 5, 10)), ((a + b)/2 + Vector((0, 0, zpx(44)))), rot=(R(90), 0, math.atan2(d.y, d.x)))
    L_at('AREA', 640, 175, 0.7, 25, (0.47, 0.89, 0.91), 0.8, aim_to=tuple(unproj(640, 260)))
    pp = unproj(403, 310); bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.12, depth=zpx(115), location=(pp.x, pp.y, zpx(115)/2))
    pil = bpy.context.object; pil.data.materials.append(srgb('pillar', (44, 54, 70), rough=0.6))
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.15, depth=0.04, location=(pp.x, pp.y, zpx(115))); cap = bpy.context.object; cap.data.materials.append(srgb('pcap', (60, 72, 90)))
    kp('trashcan', 335, 205, s=1.3, val=0.45); paper_bits(335, 200, 30, 12, 6, seed=8, z=0.35)
    # the single lamp
    L_at('SPOT', 640, 420, 3.6, 1100, (1.0, 0.74, 0.50), 0.5, spot=58, blend=0.7)
    fg([pil, cap], 312, 'pillar')

# ================= 6. MESSAGE ROOM =================
def P_message():
    calm_base(amb=(0.24, 0.34, 0.56), amb_e=30)
    fm = floor_mat('mfloor', tex='floor_wood.png', tint=(110, 110, 120), rough=0.5); wm = srgb('mwall', (26, 38, 54), rough=0.9)
    floor_rect(360, 260, 560, 400, fm, tile=0.8)
    wall_seg(360, 920, 260, 210, wm)
    on_wall(376, 904, 66, 252, 260, emit_mat('chatscr', (14, 26, 36), 1.0), eps=0.02, name='chatwall')
    on_wall(372, 908, 62, 66, 260, srgb('bezel', (40, 48, 60), metal=0.6), eps=0.03)
    L_at('AREA', 640, 300, 1.2, 50, (0.45, 0.8, 0.9), 3.0, aim_to=tuple(unproj(640, 500)))
    # stairwell down (right): a dark well with steps + the FLOOR 1 bracket on the wall above it
    hole = srgb('well', (2, 4, 8)); floor_rect(862, 282, 56, 116, hole, z=0.003, solid=0.0)
    sp = unproj(890, 330, -0.5); cprop('stairs', sp.x, sp.y, SCR_RZ + 90, s=0.5, z=-0.5, val=0.5)
    on_wall(864, 916, 214, 226, 260, srgb('mbr', (60, 70, 80), metal=0.6), eps=0.03, name='bracket')
    rail = srgb('mrail', (70, 86, 100), metal=0.8); rr = [post_at(862, 400, 40, rail, 0.03), post_at(918, 400, 40, rail, 0.03), bar_between(862, 918, 400, zpx(40), rail, 0.02)]
    bn = kp('bench', 450, 610, 0, s=1.0, val=0.45); kp('pottedPlant', 395, 300, s=1.2); kp('lampRoundFloor', 880, 620, s=0.9); p = unproj(880, 600); lamp_glow(p.x, p.y, 0.95, 10)
    L_at('SPOT', 640, 480, 3.0, 360, (1.0, 0.74, 0.50), 0.5, spot=55, blend=0.9)
    fg(meshes_of(bn), 630, 'bench'); fg(rr, 400, 'stair_rail')

BRIDGE = {}
HUBCLOCK = {}
def bridge_pose(ang, chains=True):
    """ang 90 = raised (deck vertical), 0 = lowered flat. Rebuilds the two chains from the winch to the deck's far corners."""
    B = BRIDGE; q = Quaternion(B['axis'], -R(ang)); B['piv'].rotation_quaternion = q; bpy.context.view_layer.update()
    for o in B.get('chain', []): bpy.data.objects.remove(o, do_unlink=True)
    B['chain'] = []
    if not chains: return
    top = unproj(428, 382, zpx(56)); end0 = B['hinge'] + q @ (B['ux']*B['span']*0.55)
    for lat in (-B['wid']/2, B['wid']/2):
        a = top + B['axis']*lat*0.4; b = end0 + B['axis']*lat + q @ Vector((0, 0, 0.34)); L = (b - a).length; n = max(8, int(L/0.09))
        sag = 0.25 if ang < 20 else 0.05
        for k in range(n):
            u = (k + 0.5)/n; p = a.lerp(b, u); p.z -= sag*4*u*(1 - u)
            bpy.ops.mesh.primitive_torus_add(major_radius=0.034, minor_radius=0.009, location=p, rotation=(R(90) if k % 2 else 0, 0, math.atan2((b-a).y, (b-a).x)))
            l_ = bpy.context.object; l_.data.materials.append(B['iron']); B['chain'].append(l_)
ROOMS6.update({'R7_office': P_office, 'R7_hub': P_hub, 'R7_corridor_dark': P_corridor, 'R7_corridor_lit': P_corridor,
               'R7_archive_H': P_archive, 'R7_archive_L': P_archive,
               'R7_arena': P_arena, 'R7_message': P_message})
