# art-v6 P2 rooms (exec'd at the end of rooms6.py): floor 4 (R12-R15), floor 5 (R16, R17), quiet/elite rooms R3, R4, R9, R0.
# Same calm rules: one warm + one cool family, one accent, edge clusters, <= 2 phrases, open floor.
WARM = (1.0, 0.72, 0.46); COOL = (0.50, 0.78, 0.90)
def carpet(rgb, alpha_tex=None):
    plane('carpet', 8.7, 5.6, srgb('carpet', rgb, rough=0.95), (0.05, 1.2, 0.002), index=IDX['env'])
def wall_pic(name, tex, x, z, w, h, emit=0.25, y=3.985):
    return plane(name, w, h, img_mat(name, tex, emit=emit), (x, y, z), rot=(R(90), 0, 0), index=IDX['env'])
def lwall_pic(name, tex, y, z, w, h, emit=0.25, x=-4.085):
    return plane(name, w, h, img_mat(name, tex, emit=emit), (x, y, z), rot=(R(90), 0, R(-90)), index=IDX['env'])
def alpha_mat(name, tex, emit=0.6):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    for n_ in list(nt.nodes):
        if n_.type != 'OUTPUT_MATERIAL': nt.nodes.remove(n_)
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(tex, check_existing=True)
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs[1].default_value = emit; nt.links.new(t.outputs['Color'], em.inputs[0])
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(t.outputs['Alpha'], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], nt.nodes['Material Output'].inputs[0]); m.blend_method = 'BLEND'; return m
def cyl(name, r, d, loc, m, verts=32, index=0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d, location=loc, rotation=rot); o = bpy.context.object; o.data.materials.append(m); o.pass_index = index; return o
def sphere(name, r, loc, m, scale=(1, 1, 1), index=0):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=24, ring_count=12); o = bpy.context.object; o.data.materials.append(m); o.scale = scale; o.pass_index = index; bpy.ops.object.shade_smooth(); return o
def warm_pool(x, y, e=700, spot=44, z=3.4):
    light('SPOT', (x, y, z), e, WARM, 0.6, spot=spot, blend=0.8)
def cool_wash(x, y, e=120, spot=65):
    light('SPOT', (x, y, 3.0), e, COOL, 0.6, spot=spot, blend=1.0)
def tape_line(x0, y0, x1, y1, w=0.035):
    L = math.hypot(x1-x0, y1-y0); a = math.degrees(math.atan2(y1-y0, x1-x0))
    plane('tape', L, w, emit_mat('tape', (232, 110, 110), 0.55), ((x0+x1)/2, (y0+y1)/2, 0.004), rot=(0, 0, R(a)), index=IDX['env'])
def binder(x, y, rz, h=0.9, col=(52, 58, 96), tabs=True, w=0.5, d=0.34):
    e = bpy.data.objects.new('binder', None); sc.collection.objects.link(e); e.location = (x, y, 0); e.rotation_euler = (0, 0, R(rz))
    b = box('bind', (w, d, h), (0, 0, h/2), srgb('bindc%d' % sum(col), col, rough=0.5), bevel=0.015); b.parent = e
    pg = box('bpg', (w*0.94, d*0.7, h*0.96), (0.03, 0, h/2), srgb('bpaper', (210, 204, 190), rough=0.8)); pg.parent = e
    for i, ring_z in enumerate((0.25, 0.5, 0.75)):
        r_ = box('bring', (0.02, d*1.02, 0.03), (-w/2 - 0.005, 0, h*ring_z), srgb('bring', (170, 176, 186), metal=0.9, rough=0.3)); r_.parent = e
    if tabs:
        for i, c in enumerate(((230, 160, 84), (116, 200, 180), (150, 128, 226))):
            t = box('btab', (0.06, 0.07, 0.06), (w/2 + 0.02, -d*0.2 + i*0.12, h*(0.3 + 0.2*i)), srgb('btab%d' % i, c, rough=0.5)); t.parent = e
    return e

# ================= R12 TOWN HALL (fork A: Sycophants + APPLAUSE IS LOUD) =================
def R12():
    shell(wall=(36, 50, 60), trim=(24, 34, 42)); world(); carpet((58, 76, 70))
    # stage + podium (back centre) under the huge dim 4.9 scoreboard
    box('stage', (3.4, 1.0, 0.22), (0.3, 3.45, 0.11), srgb('stage', (44, 40, 40), rough=0.6), bevel=0.02, index=IDX['env'])
    box('stageedge', (3.4, 0.02, 0.02), (0.3, 2.95, 0.21), emit_mat('stagelip', (214, 176, 96), 0.4), index=IDX['env'])
    box('podium', (0.42, 0.34, 0.62), (0.3, 3.4, 0.53), srgb('podium', (70, 56, 46), rough=0.5), bevel=0.02)
    wall_pic('score', TX6+'score49.png', 0.3, 1.2, 1.9, 0.73, emit=0.45)
    light('SPOT', (0.3, 2.9, 2.8), 260, WARM, 0.3, spot=26, blend=0.6)              # the podium spotlight
    # tiered empty chairs along both edges (rows face the stage)
    for col_, xs in ((-1, (-3.75, -3.15)), (1, (3.35, 3.95))):
        for x in xs:
            for y in (0.0, 0.7, 1.4, 2.1):
                cprop('chairModernCushion', x, y, 180 - col_*35, s=0.9, val=0.5, sat=0.35)
    plane('reserved', 0.16, 0.10, img_mat('reserved', TX6+'reserved.png', emit=0.3), (-3.15, 0.0, 0.47), rot=(R(70), 0, R(-35)))
    prop('pottedPlant', -3.6, -1.85, 0, s=1.8)
    base_lights(amb=(0.26, 0.40, 0.56), amb_e=58)
    warm_pool(-0.2, 1.1, 640); cool_wash(-3.4, 1.0, 140); cool_wash(3.6, 1.0, 120)
    rule_tiles(['APPLAUSE', 'IS', 'LOUD'], 0.3, 2.45, h=0.2)
    place_noor(-0.9, 0.35, 'NE', 'idle', 10)
    place_enemy('caret', -1.5, 0.05, 'S', 'idle', 2)
    place_enemy('sycophant', 1.35, 1.35, 'SW', 'idle', 0)
    place_enemy('sycophant', 2.3, 0.55, 'SW', 'idle', 3)
    place_enemy('sycophant', -1.6, 1.95, 'SE', 'idle', 1)
    place_enemy('autocomplete', -2.1, 1.25, 'S', 'move', 2)

# ================= R13 SORRY LIGHTS (fork B: Apology Moths, lantern grid) =================
def lantern(x, y, lit=True, z=2.05):
    cyl('lcord', 0.004, 0.5, (x, y, z + 0.38), srgb('cord', (30, 30, 34)))
    m = emit_mat('lanlit' if lit else 'landim', (255, 200, 140) if lit else (120, 96, 80), 2.2 if lit else 0.25)
    sphere('lantern', 0.15, (x, y, z), m, scale=(1, 1, 1.25))
    for dz in (-0.17, 0.17): cyl('lrim', 0.07, 0.02, (x, y, z + dz), srgb('lrim', (60, 50, 44)))
    if lit:
        light('POINT', (x, y, z - 0.05), 18, WARM, 0.15); light('SPOT', (x, y, z - 0.2), 140, WARM, 0.2, spot=60, blend=0.9)
def R13():
    shell(wall=(36, 48, 62), trim=(24, 32, 44)); door(2.7, accent=(150, 180, 200)); world(); carpet((56, 72, 68))
    # recognition gallery: framed Employee of the Month photos with blank faces (one shows a sign-painter's brush)
    for i, x in enumerate((-3.4, -2.6, -1.8, -1.0, 0.0, 0.8, 1.6)):
        wall_pic('eotm%d' % i, TX6+('eotm_brush.png' if i == 4 else 'eotm_blank.png'), x, 1.35, 0.42, 0.55, emit=0.2 if i != 4 else 0.35)
    for i, y in enumerate((0.6, 1.5, 2.4, 3.3)): lwall_pic('eotmL%d' % i, TX6+'eotm_blank.png', y, 1.35, 0.42, 0.55, emit=0.18)
    # signature: the 3x3 lantern grid over the open floor (three dimmed by moths)
    dim = {(0, 2), (2, 1), (1, 0)}
    for i, x in enumerate((-1.7, 0.4, 2.5)):
        for j, y in enumerate((0.5, 1.75, 3.0)): lantern(x, y, (i, j) not in dim)
    prop('benchCushionLow', 3.55, 0.6, 90); prop('pottedPlant', 3.85, 3.6, 0)
    prop('pottedPlant', -3.6, -1.85, 0, s=1.8)
    base_lights(amb=(0.24, 0.36, 0.56), amb_e=52)
    place_noor(-1.0, 0.95, 'E', 'idle', 10)
    place_enemy('caret', -1.6, 0.55, 'S', 'idle', 4)
    place_enemy('moths', 0.6, 1.95, 'S', 'idle', 1)
    place_enemy('moths', 2.3, 0.75, 'S', 'move', 2)
    place_enemy('moths', -1.7, 2.75, 'S', 'landed', 3)
    place_enemy('sycophant', 2.6, 2.5, 'SW', 'idle', 2)

# ================= R14 WELLNESS ROOM (quiet: beanbag, salt lamp, BREATHE) =================
def R14():
    shell(wall=(44, 50, 62), trim=(28, 32, 42)); door(2.4, accent=(150, 180, 200)); world(); carpet((60, 64, 74))
    # small room: two soft partitions pull the walls in
    partition(-1.9, 1.6, 2.6, 90, h=1.1); partition(3.0, 1.2, 2.0, 90, h=1.1)
    # window with the sky just short of dawn (cool), the Draft on the sill
    box('winpane', (1.3, 0.02, 0.9), (0.6, 3.975, 1.3), emit_mat('dawn', (70, 96, 140), 0.55), index=IDX['env'])
    box('winframe', (1.4, 0.06, 0.06), (0.6, 3.95, 0.82), srgb('wf', (40, 46, 56)), index=IDX['env'])
    box('sill', (1.4, 0.22, 0.05), (0.6, 3.86, 0.80), srgb('sill2', (80, 72, 66)))
    light('AREA', (0.6, 3.5, 1.3), 30, (0.55, 0.68, 0.95), 1.2, rot=(R(80), 0, 0))
    place_enemy('draft', 0.6, 3.75, 'S', 'idle', 3, z=0.62)
    wall_pic('breathe', TX6+'breathe.png', -0.85, 1.25, 0.42, 0.59, emit=0.15)
    wall_pic('cork', TX6+'test3412.png', 2.1, 1.2, 0.5, 0.40, emit=0.2)
    # signature: the salt lamp, the warmest light on the floor, with the beanbag in its pool
    box('lampstand', (0.3, 0.3, 0.32), (-1.15, 2.85, 0.16), srgb('stand', (60, 52, 48)))
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.16, location=(-1.15, 2.85, 0.47)); sl = bpy.context.object; sl.scale = (0.9, 0.9, 1.25); sl.data.materials.append(emit_mat('salt', (255, 150, 120), 3.0))
    light('POINT', (-1.15, 2.85, 0.5), 60, (1.0, 0.62, 0.50), 0.2); light('SPOT', (-0.7, 2.2, 2.6), 380, (1.0, 0.66, 0.52), 0.4, spot=46, blend=0.85)
    sphere('beanbag', 0.42, (-0.55, 2.15, 0.22), srgb('bean', (150, 96, 104), rough=0.95), scale=(1.1, 1.0, 0.55))
    cyl('noise', 0.09, 0.08, (2.55, 2.75, 0.43), srgb('noisem', (210, 210, 205), rough=0.4)); cprop('sideTable', 2.55, 2.75, 0, s=0.9, val=0.5)
    prop('plantSmall2', -1.6, 3.6, 0, s=1.6)
    prop('pottedPlant', -3.6, -1.85, 0, s=1.8)
    base_lights(amb=(0.24, 0.34, 0.54), amb_e=46)
    place_noor(0.5, 1.15, 'NW', 'idle', 10)
    place_enemy('caret', 1.1, 0.8, 'S', 'idle', 2)

# ================= R15 EMPLOYEE OF THE MONTH (elite: The 4.9) =================
def R15():
    shell(wall=(40, 50, 60), trim=(26, 34, 42)); world(); carpet((56, 72, 66))
    door(-3.0, accent=(150, 180, 200)); door(3.2, accent=(150, 180, 200))
    lm = alpha_mat('laurel', TX6+'laurel.png', 0.55); plane('laurel', 1.7, 1.28, lm, (0.3, 3.975, 1.1), rot=(R(90), 0, 0), index=IDX['env'])
    cprop('rugRound', 0.4, 1.75, 0, s=3.2, val=0.45, sat=0.35)
    # confetti paused mid-air (a few flakes only)
    rnd = random.Random(8)
    for i in range(22):
        c = rnd.choice(((214, 176, 96), (250, 150, 212), (220, 214, 200)))
        plane('conf', 0.045, 0.028, emit_mat('conf%d' % sum(c), c, 0.6), (rnd.uniform(-2.6, 3.2), rnd.uniform(0.6, 3.4), rnd.uniform(1.2, 2.2)), rot=(R(rnd.uniform(0, 180)), R(rnd.uniform(0, 180)), 0), index=IDX['env'])
    prop('pottedPlant', -3.6, -1.85, 0, s=1.8)
    base_lights(amb=(0.24, 0.36, 0.56), amb_e=52)
    warm_pool(0.4, 1.4, 420, spot=50)
    # The 4.9 + its five stars (pools on the floor are the rating beams); the cracked one hangs lower
    CX, CY = 0.5, 2.15; place_enemy('the49', CX, CY, 'S', 'idle', 1)
    for i, a in enumerate((200, 250, 300, 350, 160)):
        x = CX + 1.45*math.cos(math.radians(a)); y = CY + 0.95*math.sin(math.radians(a))
        place_enemy('star49x' if i == 4 else 'star49', x, y, 'S', 'idle', i)
        light('SPOT', (x, y, 2.6), 90, (1.0, 0.80, 0.52), 0.2, spot=18, blend=0.6)
    rule_tiles(['STARS', 'RATE', 'NOOR'], CX, CY, h=0.15, z=1.5, floating=True, emit=0.9)
    rule_tiles(['FLOOR', 'REWARDS', 'PRAISE'], -2.55, 0.95, h=0.17)
    place_noor(-0.6, 0.45, 'NE', 'idle', 10)
    place_enemy('caret', -1.2, 0.1, 'S', 'idle', 1)
    place_enemy('sycophant', -2.9, 2.3, 'SE', 'move', 2)
    place_enemy('sycophant', 3.3, 2.2, 'SW', 'idle', 0)

# ================= R16 THE DRAFTS FOLDER (her kitchen at 03:12, huge) =================
def tabletop(r=None, wood_tex='floor_wood.png'):
    fm = img_mat('tabletop', TX5+wood_tex, rough=0.5)
    if r:
        bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=r, depth=0.3, location=(0.3, 1.5, -0.15)); t = bpy.context.object; t.data.materials.append(fm); t.pass_index = IDX['env']
        bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=0.008, major_segments=96, minor_segments=6, location=(0.3, 1.5, 0.0)); bpy.context.object.data.materials.append(emit_mat('rimline', (110, 170, 190), 0.5)); bpy.context.object.pass_index = IDX['env']
        return t
    fl = plane('table', 8.7, 5.6, fm, (0.05, 1.2, 0), index=IDX['env'])
    for lp in fl.data.uv_layers.active.data: lp.uv = (lp.uv.x*8.7/3.0, lp.uv.y*5.6/3.0)
    box('tslab', (8.7, 5.6, 0.4), (0.05, 1.2, -0.201), srgb('tslab', (40, 28, 22), rough=0.7), index=IDX['env'])
    return fl
def R16():
    global CAM_T; tabletop(); world(0.8)
    # giant objects on the table top (edges); the path winds through the middle to the fridge light (right)
    cyl('mug', 0.62, 1.25, (-3.0, 3.1, 0.625), srgb('mug', (200, 196, 186), rough=0.4), verts=48)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.32, minor_radius=0.09, location=(-2.32, 3.1, 0.7), rotation=(R(90), 0, 0)); bpy.context.object.data.materials.append(srgb('mug', (200, 196, 186), rough=0.4))
    cyl('jar', 0.42, 0.9, (1.6, 3.4, 0.45), srgb('jar', (90, 120, 130), rough=0.15, metal=0.0), verts=40)
    for i, (dx, dy, tilt) in enumerate(((-0.1, 0.05, 8), (0.12, -0.05, -10), (0.0, 0.12, 3))):
        cyl('brush', 0.03, 1.4, (1.6 + dx, 3.4 + dy, 1.2), srgb('brushh', (130, 90, 60), rough=0.6), verts=10, rot=(R(tilt), R(-tilt*0.6), 0))
        cyl('bristle', 0.045, 0.16, (1.6 + dx + math.sin(R(-tilt*0.6))*0.7, 3.4 + dy - math.sin(R(tilt))*0.7, 1.95), srgb('bristle', (236, 172, 92), rough=0.8), verts=10, rot=(R(tilt), R(-tilt*0.6), 0))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.32, minor_radius=0.05, location=(-2.9, 0.6, 0.05)); bpy.context.object.data.materials.append(srgb('keyring', (170, 176, 186), metal=0.9, rough=0.3))
    box('key1', (0.9, 0.22, 0.05), (-2.25, 0.85, 0.03), srgb('keym', (186, 160, 100), metal=0.9, rough=0.3), rot=(0, 0, R(20)))
    # signature: her phone face up, Kabir's chat, the only cyan light (typing dots that never resolve)
    box('phonebody', (0.8, 1.5, 0.08), (-0.6, 2.85, 0.04), srgb('phb', (16, 18, 24), rough=0.3), bevel=0.05, rot=(0, 0, R(12)))
    plane('phonescr', 0.7, 1.33, img_mat('phscr', TX6+'phone_kabir.png', emit=1.0), (-0.6, 2.85, 0.082), rot=(0, 0, R(12)), index=IDX['env'])
    light('AREA', (-0.6, 2.85, 0.6), 18, (0.55, 0.88, 0.95), 1.0)
    # the fridge at the right edge: its door light is the way into the Core; Kabir's sticky note on the door
    box('fridge', (1.1, 1.0, 2.2), (3.9, 2.4, 1.1), srgb('fridge', (170, 178, 186), rough=0.35))
    box('fridgegap', (0.03, 0.9, 2.0), (3.33, 2.4, 1.05), emit_mat('fridgelight', (210, 236, 246), 3.0), index=IDX['env'])
    light('AREA', (3.1, 2.4, 1.0), 40, (0.75, 0.9, 1.0), 0.5, rot=(0, R(-90), 0))
    plane('stickyk', 0.24, 0.24, img_mat('eatk', TX6+'eat_k.png', emit=0.25), (3.335, 2.0, 1.45), rot=(R(90), 0, R(-90)))
    # giant chair legs as pillars (dark foreground framing) and the pendant lamp (the one warm light)
    for (x, y) in ((-3.9, -1.3), (-3.1, -1.3)): cyl('chairleg', 0.09, 3.0, (x, y, 1.0), srgb('chairleg', (34, 26, 22), rough=0.6), verts=16)
    pendant(0.0, 1.5, 3.2, energy=0); light('SPOT', (0.0, 1.5, 3.5), 1300, WARM, 0.6, spot=50, blend=0.85)
    light('AREA', (0.4, 1.3, 4.0), 30, (0.24, 0.32, 0.6), 8.0)                          # navy fill
    # the Drafts found so far float as paper planes stuck mid-flight; the unfound ones are faint outlines
    for (x, y, z) in ((-1.6, 1.9, 0.55), (0.9, 2.5, 0.8), (2.2, 1.3, 0.65), (0.2, 3.3, 0.9)): place_enemy('draft', x, y, 'S', 'idle', int(x*3) % 8, z=z)
    om = emit_mat('draftghost', (150, 190, 210), 0.35)
    for (x, y, z) in ((-0.9, 3.5, 1.0), (2.8, 3.3, 1.1), (-2.2, 2.2, 0.9)):
        bpy.ops.mesh.primitive_plane_add(size=0.35, location=(x, y, z), rotation=(R(70), 0, R(25))); o = bpy.context.object; o.data.materials.append(om); o.modifiers.new('w', 'WIREFRAME').thickness = 0.008
    place_noor(-0.9, 0.7, 'NE', 'walk', 3)
    place_enemy('caret', -1.5, 0.4, 'S', 'idle', 3)

# ================= R17 FERN (boss: the table top floating in navy) =================
def R17():
    global CAM_T; CAM_T = (0.3, 1.6); tabletop(r=3.05); world(0.8)
    # rim of giant chair silhouettes round the back half (Kabir's chair is the one pulled out)
    for i, a in enumerate((170, 145, 35, 10)):
        x = 0.3 + 3.55*math.cos(R(a)); y = 1.5 + 2.6*math.sin(R(a))
        e = cprop('chair', x, y, a + 90 + (25 if i == 1 else 0), s=2.6, z=-0.6, val=0.12, sat=0.2)
    pendant(-0.6, 0.6, 2.7, energy=0); light('SPOT', (0.3, 1.4, 3.4), 1200, WARM, 0.6, spot=46, blend=0.85)
    light('AREA', (0.4, 1.3, 4.0), 26, (0.24, 0.32, 0.6), 8.0)
    # ice fragments drifting at the rim (the accent)
    rnd = random.Random(4); im = emit_mat('icefrag', (200, 236, 246), 1.6)
    for i in range(14):
        a = rnd.uniform(0, 2*math.pi); r_ = rnd.uniform(2.6, 3.2)
        bpy.ops.mesh.primitive_cube_add(size=rnd.uniform(0.04, 0.08), location=(0.3 + r_*math.cos(a), 1.5 + r_*0.85*math.sin(a), rnd.uniform(0.2, 1.4)), rotation=(rnd.random()*3, rnd.random()*3, 0)); bpy.context.object.data.materials.append(im); bpy.context.object.pass_index = IDX['env']
    build_fern(0.6, 2.75, 2.0, rz=SCR_RZ)
    rule_tiles(['FERN', 'IS', 'NOOR'], 0.6, 2.75, h=0.15, z=2.12, floating=True, emit=0.9)
    rule_tiles(['NEVER', 'TIRED'], 0.6, 2.75, h=0.15, z=1.9, floating=True, emit=0.9)
    place_noor(-0.5, 0.5, 'NE', 'idle', 10)
    place_enemy('caret', -1.1, 0.25, 'S', 'idle', 0)

# ================= R3 READING ROOM (quiet: Papa's SETHI SIGNS board) =================
def R3():
    shell(wall=(38, 50, 66), trim=(26, 34, 46)); world(); carpet((44, 50, 66))
    cprop('rugRound', 0.3, 1.7, 0, s=3.6, val=0.45, sat=0.35)
    # curved stacks round the back (the room is round): bookcases on an arc
    for a in (160, 140, 120, 100, 80, 60, 40, 20):
        x = 0.3 + 3.9*math.cos(R(a)); y = 1.2 + 2.6*math.sin(R(a))
        if 70 < a < 110: continue
        cprop('bookcaseClosedWide', x, y, a - 90, s=1.0, val=0.45)
    # tall window onto the dark stacks (cool) behind where the arc opens
    box('tallwin', (1.0, 0.02, 1.9), (0.3, 3.975, 1.1), emit_mat('stackswin', (50, 86, 110), 0.5), index=IDX['env'])
    for xx in (-0.2, 0.3, 0.8): box('winbar', (0.04, 0.04, 1.9), (xx, 3.96, 1.1), srgb('wb', (30, 36, 46)), index=IDX['env'])
    light('AREA', (0.3, 3.5, 1.2), 30, COOL, 1.0, rot=(R(80), 0, 0))
    # the long table with one brass lamp; the Draft rests in the lamp pool
    cprop('table', 0.3, 2.15, 0, s=1.5, val=0.45)
    cprop('lampRoundTable', -0.1, 2.25, 0, s=0.9, z=0.57); lamp_glow(-0.1, 2.2, 0.85, 14)
    light('SPOT', (0.2, 2.1, 2.6), 420, WARM, 0.3, spot=36, blend=0.8)
    place_enemy('draft', 0.65, 2.1, 'S', 'idle', 1, z=0.58)
    # signature: Papa's hand-painted SETHI SIGNS board leaning against the left wall (the room's one phrase)
    si = bpy.data.images.load(TX6+'sethi_signs.png'); sw = 0.42*si.size[0]/si.size[1]
    plane('sethi', sw, 0.42, img_mat('sethi', TX6+'sethi_signs.png', emit=0.35), (-2.65, 1.75, 0.25), rot=(R(78), 0, R(SCR_RZ + 25)), index=IDX['env'])
    light('SPOT', (-2.6, 0.9, 1.8), 90, WARM, 0.2, spot=35, blend=0.8)
    # three ticket desks round the edge; the index drawer SETHI, R. open and empty
    for (x, y, rz) in ((-3.3, 0.0, 70), (3.5, 0.4, -70), (3.6, 2.1, -95)):
        st, (dw, dd, dh) = desk_station(x, y, rz, on=False, nameplate=False, s=0.8)
        p_ = plane('tk', 0.12, 0.16, srgb('ticketpaper', (226, 220, 204), rough=0.8), (0, 0, dh + 0.003)); p_.parent = st
    cprop('kitchenCabinetDrawer', -3.65, 2.65, 70, s=0.9, val=0.5)
    prop('pottedPlant', -3.6, -1.85, 0, s=1.8)
    base_lights(amb=(0.26, 0.38, 0.56), amb_e=50)
    place_noor(-0.6, 0.6, 'NE', 'idle', 10)
    place_enemy('caret', -1.2, 0.3, 'S', 'idle', 1)

# ================= R4 SAVED REPLIES (elite: The Macro) =================
def R4():
    shell(wall=(36, 48, 66), trim=(24, 32, 46)); door(-2.4, accent=(110, 200, 220)); world()
    # print room of tall ring binders along the back wall, coloured tabs
    cols = ((52, 58, 96), (60, 70, 110), (46, 52, 84))
    for i, x in enumerate((-1.5, -0.9, -0.3, 0.3, 0.9, 1.5, 2.1, 2.7, 3.3)): binder(x, 3.75, 0, h=1.05, col=cols[i % 3], w=0.52, d=0.34)
    for i, y in enumerate((0.6, 1.2, 1.8, 2.4, 3.0)): binder(-3.85, y, 90, h=1.5, col=cols[(i+1) % 3], w=0.52, d=0.34)
    # four squat binder pillars near the walls (cover from ink copies)
    for (x, y) in ((-2.6, 0.2), (-2.6, 2.7), (3.1, 0.3), (3.1, 2.5)): binder(x, y, 15, h=0.7, col=cols[0], w=0.6, d=0.45)
    # signature: the wide lightbox table glowing paper-white under the Macro; stamp decals on the floor
    box('lbbase', (1.6, 0.9, 0.36), (1.95, 2.25, 0.18), srgb('lbb', (40, 44, 58), rough=0.5), bevel=0.02)
    box('lbtop', (1.5, 0.8, 0.02), (1.95, 2.25, 0.37), emit_mat('lightbox', (236, 232, 220), 1.6))
    light('AREA', (1.95, 2.25, 0.6), 40, (1.0, 0.9, 0.78), 1.0)
    for (x, y, rz) in ((-1.2, 1.6, 10), (1.9, 1.2, -15), (-0.4, 0.2, 30), (2.0, -0.3, 5), (-1.9, -0.6, -20)):
        floor_decal('stamp', TX6+'stamp_decal.png', x, y, 0.55, 0.55, rz=rz, emit=0.35)
    # the easel with the 80% slide; a box of eleven desk nameplates
    plane('pie', 0.6, 0.45, img_mat('pie', TX6+'pie80.png', emit=0.3), (-3.05, 3.35, 0.95), rot=(R(80), 0, R(SCR_RZ)))
    for dx in (-0.2, 0.2): cyl('easel', 0.015, 1.1, (-3.05 + dx, 3.42, 0.55), srgb('easel', (100, 76, 56)), verts=6, rot=(R(-10), 0, 0))
    cprop('cardboardBoxOpen', 2.0, 3.25, 10, s=0.9, val=0.55)
    prop('pottedPlant', -3.6, -1.85, 0, s=1.8)
    base_lights(amb=(0.24, 0.36, 0.60), amb_e=56)
    warm_pool(0.0, 1.0, 620)
    place_enemy('macro', 0.35, 1.05, 'S', 'idle', 2)
    rule_tiles(['MACRO', 'COPIES', 'NOOR'], 0.35, 1.05, h=0.15, z=1.68, floating=True, emit=0.9)
    place_noor(-1.1, 0.35, 'NE', 'idle', 10)
    place_enemy('caret', -1.7, 0.05, 'S', 'idle', 2)
    place_enemy('autocomplete', 1.9, 0.55, 'S', 'move', 1)
    place_enemy('autocomplete', -1.85, 1.55, 'S', 'idle', 4)

# ================= R9 TURNSTILES (Review + name chips; coral tape as walls) =================
def turnstile(x, y, locked=False):
    gm = srgb('tpost', (150, 160, 170), rough=0.3, metal=0.7)
    box('tpost', (0.16, 0.5, 0.95), (x, y, 0.475), gm, bevel=0.02)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(x + 0.3, y, 0.6), rotation=(R(90), 0, 0)); g = bpy.context.object; g.scale = (0.45, 0.5, 1)
    gl = bpy.data.materials.new('tglass'); gl.use_nodes = True; b = gl.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (0.6, 0.75, 0.85, 1); b.inputs['Alpha'].default_value = 0.25; b.inputs['Roughness'].default_value = 0.05; gl.blend_method = 'BLEND'
    g.data.materials.append(gl)
    c = (232, 96, 106) if locked else (220, 232, 236)
    box('tlight', (0.06, 0.06, 0.03), (x, y - 0.18, 0.97), emit_mat('tl%d' % locked, c, 2.5))
def R9():
    shell(wall=(44, 54, 64), trim=(30, 36, 44)); door(-0.6, accent=(150, 180, 200)); world()
    # row of glass turnstiles splitting the hall (three lanes) + one visitor turnstile in the far corner
    for i, x in enumerate((-2.9, -1.9, -0.9, 0.9, 1.9)): turnstile(x, 3.25, locked=(i in (1, 3)))
    turnstile(3.2, 3.55, locked=True)
    # thin coral tape lines on the floor act as walls
    tape_line(-3.9, 2.95, -0.3, 2.95); tape_line(0.6, 2.95, 2.6, 2.95); tape_line(2.6, 2.95, 2.6, 3.9); tape_line(-1.4, 2.95, -2.4, 0.4)
    place_enemy('draft', 3.6, 3.45, 'S', 'idle', 6)
    # security desk with the one warm lamp; the lost-property tray (Kabir's visitor badge)
    cprop('desk', -3.5, 1.2, 90, s=0.95, val=0.42); cprop('chairDesk', -3.0, 1.2, -90, s=0.9, val=0.55, sat=0.3)
    cprop('lampSquareTable', -3.6, 1.55, 0, s=0.9, z=0.34); lamp_glow(-3.6, 1.5, 0.55, 10)
    light('SPOT', (-3.2, 1.3, 2.4), 260, WARM, 0.3, spot=40, blend=0.8)
    box('tray', (0.3, 0.2, 0.03), (-3.55, 0.85, 0.355), srgb('tray2', (60, 66, 80)))
    plane('kbadge', 0.12, 0.09, img_mat('kbadge', TX6+'kabir_badge.png', emit=0.3), (-3.55, 0.85, 0.375), rot=(0, 0, R(20)))
    prop('pottedPlant', 3.6, -1.85, 0, s=1.8)
    base_lights(amb=(0.30, 0.42, 0.58), amb_e=60)
    for (x, y) in ((-1.6, 1.0), (1.6, 1.0), (0.0, 2.6)): light('AREA', (x, y, 3.0), 60, (0.70, 0.80, 0.90), 1.2)   # mist from above
    place_enemy('warden', 0.2, 1.0, 'S', 'idle', 0)
    rule_tiles(['WARDEN', 'REFUSES', 'NOOR'], 0.2, 1.0, h=0.15, z=1.45, floating=True, emit=0.9)
    rule_tiles(['TAPE', 'IS', 'SOLID'], 1.6, 0.15, h=0.18)
    place_noor(-1.1, 0.3, 'NE', 'idle', 10)
    place_enemy('caret', -1.7, 0.0, 'S', 'idle', 2)
    place_enemy('redactor', 1.6, 1.2, 'W', 'idle', 1)
    place_enemy('redactor', -2.6, 1.95, 'E', 'move', 2)

# ================= R0 LIFT LOBBY (hub: Dez, the floor dial) =================
def R0():
    global CAM_T; CAM_T = (0.3, 1.7)
    shell(wall=(40, 52, 64), trim=(28, 36, 46)); world(); cprop('rugRectangle', 0.4, 1.6, 0, s=2.6, val=0.4, sat=0.35)
    # lift doors north with the brass floor-indicator dial above (needle at the deepest floor reached)
    for dx in (-0.31, 0.31): box('liftdoor', (0.6, 0.06, 1.5), (0.5 + dx, 3.96, 0.75), srgb('liftd', (120, 110, 96), rough=0.25, metal=0.85), bevel=0.01)
    box('liftframe', (1.4, 0.1, 1.65), (0.5, 3.99, 0.82), srgb('liftf', (30, 30, 34), rough=0.5))
    dm = alpha_mat('dial', TX6+'floor_dial.png', 0.9); plane('dial', 0.62, 0.36, dm, (0.5, 3.92, 1.9), rot=(R(90), 0, 0), index=IDX['env'])
    light('POINT', (0.5, 3.7, 1.9), 8, (1.0, 0.75, 0.45), 0.1)
    # reception west: a desk built from stacked QA printouts; Dez behind it; the visitor log on a lectern
    pm = srgb('printout', (218, 212, 196), rough=0.85)
    for i in range(6):
        for j in range(3): box('stack', (0.36, 0.28, 0.13), (-3.2 + j*0.37, 1.35 + (i % 2)*0.29, 0.065 + (i//2)*0.13), pm, rot=(0, 0, R((i*7 + j*5) % 9 - 4)))
    cprop('lampSquareTable', -3.35, 1.65, 0, s=0.9, z=0.39); lamp_glow(-3.35, 1.6, 0.62, 12)
    light('SPOT', (-2.9, 1.6, 2.4), 300, WARM, 0.3, spot=42, blend=0.8)
    place_enemy('dez', -3.0, 2.55, 'S', 'idle', 2)
    cyl('lectern', 0.05, 0.95, (-1.9, 1.0, 0.475), srgb('lect', (70, 56, 46)), verts=10)
    box('lecttop', (0.4, 0.3, 0.03), (-1.9, 1.0, 0.97), srgb('lect', (70, 56, 46)), rot=(R(-20), 0, R(SCR_RZ)))
    plane('vlog', 0.34, 0.25, img_mat('vlog', TX6+'visitor_log.png', emit=0.25), (-1.9, 0.99, 0.99), rot=(R(-20), 0, R(SCR_RZ)))
    # sign-off rack east: an umbrella stand of sign-offs (little cards on sticks)
    cyl('stand', 0.17, 0.5, (3.3, 2.2, 0.25), srgb('standm', (60, 66, 80), metal=0.5, rough=0.4))
    for i, c in enumerate(((236, 172, 92), (170, 232, 238), (150, 128, 226), (232, 110, 110))):
        a = i*1.6; cyl('stick', 0.012, 0.8, (3.3 + 0.07*math.cos(a), 2.2 + 0.07*math.sin(a), 0.75), srgb('stickm', (90, 80, 70)), verts=6, rot=(R(8*math.sin(a)), R(8*math.cos(a)), 0))
        plane('card', 0.16, 0.1, emit_mat('card%d' % i, c, 0.5), (3.3 + 0.12*math.cos(a), 2.2 + 0.12*math.sin(a), 1.15), rot=(R(90), 0, R(a*30)))
    # the revolving door that never turns (cool night through the glass), front-right
    cyl('revolve', 0.75, 2.0, (3.2, 3.5, 1.0), srgb('revframe', (30, 34, 40), metal=0.6), verts=48).modifiers.new('w', 'WIREFRAME').thickness = 0.02
    light('AREA', (3.2, 3.5, 1.2), 50, (0.40, 0.70, 0.90), 1.2)
    prop('pottedPlant', 1.7, 3.7, 0); prop('pottedPlant', -3.6, -1.85, 0, s=1.8)
    base_lights(amb=(0.26, 0.40, 0.58), amb_e=56)
    warm_pool(0.3, 1.3, 600)
    place_noor(0.4, 1.1, 'NW', 'idle', 10)
    place_enemy('caret', -0.2, 0.8, 'S', 'idle', 2)

ROOMS6.update(R12=R12, R13=R13, R14=R14, R15=R15, R16=R16, R17=R17, R3=R3, R4=R4, R9=R9, R0=R0)
