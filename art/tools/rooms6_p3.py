# art-v6 P3: (1) custom prop renders (transparent, room camera angle) for props Kenney does not have, and
# (2) the three ending stills + the dawn epilogue (1280x720, calm rules, one warm + one cool family).
def _prop_lights(warm_e=500):
    light('AREA', (0.4, 0.3, 3.6), 50, (0.30, 0.45, 0.60), 6.0)
    k = light('AREA', (2.6, -2.4, 3.2), 120, (1.0, 0.82, 0.62), 2.5); aim(k, (0, 0, 0.5))
    light('SPOT', (0.0, 0.0, 3.2), warm_e, WARM, 0.5, spot=40, blend=0.8)
    s = light('SUN', (0, 0, 5), 0.6, (0.45, 0.75, 0.85), 6, rot=(R(-52), 0, R(165))); s.data.cycles.cast_shadow = False
def _prop_cam(o=2.6, cy=0.0, cx=0.0):
    global CAM_T, CAM_O; CAM_T = (cx, cy); CAM_O = o
def chute(CX=0.0, CY=0.0, top=2.35):
    tm = srgb('chute', (60, 72, 90), rough=0.35, metal=0.6)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.24, depth=1.2, location=(CX, CY, top)); bpy.context.object.data.materials.append(tm)
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.36, radius2=0.24, depth=0.18, location=(CX, CY, top - 0.65), end_fill_type='NOTHING'); f = bpy.context.object; f.data.materials.append(tm); f.modifiers.new('s', 'SOLIDIFY').thickness = 0.02
    bpy.ops.mesh.primitive_circle_add(vertices=24, radius=0.34, fill_type='NGON', location=(CX, CY, top - 0.73)); bpy.context.object.data.materials.append(emit_mat('chutemouth', (255, 214, 160), 2.2))
    box('tray', (0.9, 0.6, 0.12), (CX, CY, 0.06), srgb('tray', (70, 78, 96), rough=0.5), bevel=0.02)
    pp = srgb('ticketpaper', (226, 220, 204), rough=0.8); rnd = random.Random(11)
    for i in range(9): plane('tk', 0.12, 0.16, pp, (CX + rnd.uniform(-0.25, 0.25), CY + rnd.uniform(-0.18, 0.18), 0.2 + i*0.15), rot=(R(rnd.uniform(20, 70)), R(rnd.uniform(-30, 30)), R(rnd.uniform(0, 180))))
    for i in range(5): plane('tkp', 0.12, 0.16, pp, (CX + rnd.uniform(-0.35, 0.35), CY + rnd.uniform(-0.22, 0.22), 0.125), rot=(0, 0, R(rnd.uniform(0, 180))))
def Rprop_chute(): world(); chute(0, 0, 2.0); _prop_lights(); _prop_cam(3.0, 0.5)
def Rprop_turnstiles():
    world(); turnstile(-0.9, 0.0); turnstile(-0.05, 0.0, locked=True); turnstile(0.8, 0.0); _prop_lights(); _prop_cam(2.8, 0.0)
def Rprop_ticketdisplay():
    world(); bw = srgb('wallpiece', (40, 56, 70), rough=0.9); box('wallpiece', (2.0, 0.1, 1.6), (0, 0.6, 0.8), bw)
    plane('nowserving', 0.9, 0.35, img_mat('nows', TX6+'now_serving.png', emit=1.2), (-0.45, 0.545, 1.0), rot=(R(90), 0, 0))
    box('dispost', (0.05, 0.05, 0.9), (0.55, 0.2, 0.45), srgb('post', (60, 66, 80), metal=0.5)); box('disp', (0.2, 0.14, 0.26), (0.55, 0.2, 0.98), srgb('disp', (200, 90, 90), rough=0.4))
    plane('tickout', 0.06, 0.09, img_mat('ticket', TX6+'ticket.png', emit=0.2), (0.55, 0.12, 0.92), rot=(R(80), 0, 0)); _prop_lights(); _prop_cam(2.4, 0.3)
def Rprop_sethisigns():
    world(); si = bpy.data.images.load(TX6+'sethi_signs.png'); sw = 0.5*si.size[0]/si.size[1]
    b = box('signback', (sw + 0.04, 0.04, 0.54), (0, 0.12, 0.3), srgb('signback', (40, 28, 22), rough=0.7), rot=(R(-12), 0, R(SCR_RZ)))
    plane('sethi', sw, 0.5, img_mat('sethi', TX6+'sethi_signs.png', emit=0.35), (0, 0.095, 0.3), rot=(R(78), 0, R(SCR_RZ)))
    for i, (dx, c) in enumerate(((-0.5, (236, 172, 92)), (-0.38, (60, 50, 44)))): cyl('pot', 0.06, 0.1, (dx, -0.25, 0.05), srgb('pot%d' % i, c, rough=0.6))
    _prop_lights(); _prop_cam(2.2, 0.0)
def Rprop_claimants():
    world()
    for (x, y, seat, cd) in ((-0.8, 0.0, True, False), (0.0, 0.0, True, True), (0.8, 0.0, False, False)):
        if seat: cprop('chairModernCushion', x, y, 0, s=0.95, val=0.55, sat=0.4)
        paper_person(x, y + 0.04, 180, seated=seat, cardigan=cd, s=0.95)
    plane('opensign', 0.16, 0.08, img_mat('opensign', TX6+'sign_OPEN.png', emit=0.4), (0.12, -0.05, 0.47), rot=(R(70), 0, R(SCR_RZ)))
    _prop_lights(); _prop_cam(2.4, 0.0)
def Rprop_lanterns():
    world(); dim = {(0, 2), (2, 1), (1, 0)}
    for i, x in enumerate((-0.9, 0.0, 0.9)):
        for j, y in enumerate((-0.7, 0.2, 1.1)): lantern(x, y, (i, j) not in dim, z=1.2)
    _prop_lights(200); _prop_cam(3.2, 0.2)
def Rprop_laurel():
    world(); bw = srgb('wallpiece', (40, 50, 60), rough=0.9); box('wallpiece', (2.2, 0.1, 1.8), (0, 0.3, 0.9), bw)
    plane('laurel', 1.7, 1.28, alpha_mat('laurel', TX6+'laurel.png', 0.55), (0, 0.245, 0.95), rot=(R(90), 0, 0)); _prop_lights(); _prop_cam(2.6, 0.2)
PROPS = ['chute', 'turnstiles', 'ticketdisplay', 'sethisigns', 'claimants', 'lanterns', 'laurel']

# ---------------- ending stills ----------------
def _office(night=True, monitors_tex=None, emit=0.8):
    shell(wall=(36, 56, 72), trim=(24, 38, 48)); world()
    for yy in (0.45, 1.25, 2.05, 2.85):
        globals()['MON_TEX'] = monitors_tex; globals()['MON_EMIT'] = emit; st, _ = desk_station(-3.62, yy, 90, on=bool(monitors_tex))
    for xx in (1.45, 2.45, -2.75, -1.75):
        st, _ = desk_station(xx, 3.58, 0, on=bool(monitors_tex))
def RE_signed():
    """Signed: dawn through the back windows, her desk cleared, the box under her arm, Draft 12 sent."""
    global CAM_T; CAM_T = (0.3, 1.68); _office()
    for xx in (-0.2, 0.9): box('dawnwin', (0.9, 0.02, 1.2), (xx, 3.975, 1.3), emit_mat('dawnw', (255, 190, 140), 0.6), index=IDX['env'])
    light('AREA', (0.35, 3.6, 1.4), 120, (1.0, 0.70, 0.48), 2.0, rot=(R(80), 0, 0))
    box('phonebody', (0.07, 0.13, 0.012), (1.6, 3.45, 0.355), srgb('phb', (16, 18, 24))); plane('phscr', 0.06, 0.115, img_mat('phsent', TX6+'phone_sent.png', emit=1.2), (1.6, 3.45, 0.362))
    cprop('cardboardBoxClosed', -0.15, 0.55, 20, s=0.55, val=0.6)
    base_lights(amb=(0.30, 0.42, 0.58), amb_e=60)
    light('SPOT', (0.3, 1.6, 3.4), 900, (1.0, 0.74, 0.50), 0.6, spot=50, blend=0.8)
    rule_tiles(['FERN', 'CREDITS', 'NOOR'], 1.4, 1.6, h=0.2)
    place_noor(0.3, 0.6, 'N', 'walk', 2); place_enemy('caret', -0.4, 0.4, 'N', 'idle', 2)
def RE_unsent():
    """Unsent: the table top gone cold. Fern stands generic and dim; the pendant is off; she keeps her voice, alone."""
    global CAM_T; CAM_T = (0.3, 1.6); tabletop(r=3.05); world(0.6)
    pendant(0.3, 1.5, 3.0, energy=0)
    light('AREA', (0.4, 1.3, 4.0), 70, (0.35, 0.50, 0.75), 8.0); light('SPOT', (0.6, 2.7, 3.2), 160, (0.55, 0.75, 0.95), 0.6, spot=40, blend=0.9)
    top = build_fern(0.9, 2.9, 1.7, rz=SCR_RZ, light=False)
    rule_tiles(['FERN', 'FORGETS', 'NOOR'], -0.1, 1.45, h=0.18)
    place_noor(-1.2, 0.35, 'NE', 'idle', 6)
def RE_ooo():
    """Out of Office: every screen on the floor shows the one auto-reply; Noor asleep on the wellness beanbag under the salt lamp."""
    global CAM_T; CAM_T = (0.3, 1.68); _office(monitors_tex=TX6+'ooo_screen.png', emit=0.6)
    box('lampstand', (0.3, 0.3, 0.32), (0.9, 2.6, 0.16), srgb('stand', (60, 52, 48)))
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.16, location=(0.9, 2.6, 0.47)); sl = bpy.context.object; sl.scale = (0.9, 0.9, 1.25); sl.data.materials.append(emit_mat('salt', (255, 150, 120), 3.0))
    light('POINT', (0.9, 2.6, 0.5), 50, (1.0, 0.62, 0.50), 0.2); light('SPOT', (0.6, 1.8, 2.6), 420, (1.0, 0.66, 0.52), 0.4, spot=46, blend=0.85)
    sphere('beanbag', 0.46, (0.35, 1.6, 0.22), srgb('bean', (150, 96, 104), rough=0.95), scale=(1.2, 1.05, 0.55))
    root, arm, meshes = build_noor(); set_action(arm, 'sit', 3); root.location = (0.35, 1.62, 0.18); root.rotation_euler = (R(-28), 0, R(SCR_RZ + 160)); add_actor_objs(root)
    ACTOR_LOG.append(dict(name='noor', x=0.35, y=1.62, dir='asleep'))
    base_lights(amb=(0.22, 0.34, 0.54), amb_e=46)
    rule_tiles(['NOOR', 'IS', 'TIRED'], -1.2, 0.35, h=0.2)
    place_enemy('caret', 1.25, 1.2, 'S', 'idle', 2)
def RE_dawn():
    """Dawn epilogue: SETHI SIGNS, Papa's shop front, the shutter half up; Noor and Kabir on the pavement."""
    global CAM_T; CAM_T = (0.3, 1.6); world(0.6)
    fl = plane('pavement', 8.7, 5.6, srgb('pave', (70, 74, 82), rough=0.85), (0.05, 1.2, 0), index=IDX['env'])
    box('kerb', (8.7, 0.25, 0.1), (0.05, -0.9, 0.05), srgb('kerb', (110, 110, 112)), index=IDX['env'])
    plane('sky', 12, 6, img_mat('skydawn', TX6+'sky_dawn.png', emit=1.0), (0.3, 6.5, 2.0), rot=(R(90), 0, 0), index=IDX['env'])
    wm = srgb('shopwall', (120, 84, 66), rough=0.9); box('shop', (5.0, 0.3, 2.6), (0.4, 4.0, 1.3), wm, index=IDX['env'])
    box('neighbour', (2.6, 0.3, 3.2), (-3.4, 4.1, 1.6), srgb('nwall', (70, 76, 88), rough=0.9), index=IDX['env']); box('neighbour2', (2.0, 0.3, 2.8), (3.9, 4.1, 1.4), srgb('nwall2', (84, 80, 92), rough=0.9), index=IDX['env'])
    si = bpy.data.images.load(TX6+'sethi_signs.png'); sw = 0.55*si.size[0]/si.size[1]
    plane('sethi', sw, 0.55, img_mat('sethi', TX6+'sethi_signs.png', emit=0.45), (0.4, 3.84, 2.2), rot=(R(90), 0, 0), index=IDX['env'])
    box('shutter', (2.4, 0.06, 0.9), (0.4, 3.83, 1.45), srgb('shutter', (150, 154, 160), rough=0.4, metal=0.6), index=IDX['env'])
    box('shopin', (2.4, 0.02, 1.0), (0.4, 3.84, 0.5), emit_mat('shopinside', (255, 196, 130), 0.45), index=IDX['env'])
    light('AREA', (0.4, 3.4, 0.6), 120, (1.0, 0.72, 0.46), 2.0, rot=(R(80), 0, 0))
    for i, c in enumerate(((236, 172, 92), (60, 140, 160), (180, 60, 60))): cyl('paintpot', 0.08, 0.14, (-1.3 + i*0.22, 3.55, 0.07), srgb('pp%d' % i, c, rough=0.5))
    sun = light('SUN', (0, 0, 5), 2.4, (1.0, 0.78, 0.6), 2, rot=(R(-70), 0, R(170)))
    light('AREA', (0.4, 1.3, 4.0), 50, (0.40, 0.55, 0.75), 8.0)
    place_noor(0.0, 1.6, 'NE', 'idle', 10)
    os.environ['DEZM'] = 'male-d'; E = build_dez(); os.environ['DEZM'] = 'male-a'; E['root'].location = (0.75, 2.0, 0); E['root'].rotation_euler = (0, 0, R(SCR_RZ + 225)); add_actor_objs(E['root'])   # Kabir: same Kenney base, swapped model
    ACTOR_LOG.append(dict(name='kabir', x=0.75, y=2.0, dir='SW'))
for _p in PROPS: ROOMS6['Rprop_' + _p] = globals()['Rprop_' + _p]
ROOMS6.update(RE_signed=RE_signed, RE_unsent=RE_unsent, RE_ooo=RE_ooo, RE_dawn=RE_dawn)
