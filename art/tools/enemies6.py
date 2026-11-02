# art-v6 new cast (exec'd after enemies.py; same helpers, same calm palette, same camera/rig):
#   The Macro (elite F1, 4 dirs, +summon), Read Receipt (sentry, 1 dir), SLA Hound (pursuer, 4 dirs, +breach),
#   The Thread as chain parts thread_seg / thread_head / thread_tail (8 dirs, seg +split), the Draft pickup (paper plane).
# Original modelling from primitives (+ Kenney Furniture Kit CC0 parts where noted). Every root faces -Y (S).
import os
EV6 = '/workspace/games/prompt-injection/art-v6/'
def NF(E, anim): return anims_for(E['name'])[anim][0]
def lerp(a, b, t): return a + (b-a)*t
def ease(t): t = max(0.0, min(1.0, t)); return t*t*(3-2*t)

# ======================= THE MACRO (ring-binder golem, stamp head) =======================
MACRO_S = 0.72
def build_macro(index=13):
    E = _new('macro', index); root = E['root']
    cover = mat('mc_cover', (52, 58, 96), rough=0.45); E['mats']['cover'] = cover
    paper = mat('mc_paper', (226, 220, 204), rough=0.8); metal = mat('mc_ring', (176, 184, 196), rough=0.25, metal=0.9)
    wood = mat('mc_wood', (120, 84, 60), rough=0.6); dark = mat('mc_dark', (24, 28, 44), rough=0.6)
    pad = glow_mat('mc_pad', P['amber'], 0.8); E['mats']['pad'] = pad
    eye = mat('mc_eye', P['ice'], rough=0.3, emit=1.2, emit_rgb=(200, 236, 244)); E['mats']['eye'] = eye
    for sx, nm in ((-1, 'll'), (1, 'lr')):
        l = reg(E, nm, empty(nm, root, (sx*0.17, 0, 0.30)))
        cube(l, dark, (0, 0, -0.15), (0.17, 0.20, 0.30), index=index, bevel=0.03); cube(l, cover, (0, -0.03, -0.27), (0.21, 0.28, 0.07), index=index, bevel=0.02)
    body = reg(E, 'body', empty('body', root, (0, 0, 0.30)))
    cube(body, cover, (0, 0.10, 0.42), (0.74, 0.06, 0.86), index=index, bevel=0.025)                 # back cover
    reg(E, 'pages', cube(body, paper, (0.02, 0.0, 0.42), (0.66, 0.16, 0.80), index=index, bevel=0.01))
    cube(body, cover, (-0.36, 0.0, 0.42), (0.06, 0.26, 0.86), index=index, bevel=0.02)                # spine (left)
    hinge = reg(E, 'hinge', empty('hinge', body, (-0.36, -0.10, 0.42)))
    cube(hinge, cover, (0.37, -0.0, 0.0), (0.74, 0.05, 0.86), index=index, bevel=0.025)                 # front cover (swings open about the spine)
    lab = cube(hinge, paper, (0.40, -0.03, 0.18), (0.30, 0.01, 0.16), index=index)                       # label window
    for i, zz in enumerate((0.16, 0.42, 0.68)):                                                         # binder rings = ribs across the chest
        prim('torus', body, metal, (-0.33, -0.02, zz), (1, 1, 1), (0, 90, 0), index=index, major_radius=0.075, minor_radius=0.014, major_segments=24, minor_segments=6)
    tabs = reg(E, 'tabs', empty('tabs', body, (0.36, 0.0, 0.0)))
    for i, c in enumerate((P['amber'], P['mint'], P['lav'], P['coral'], P['cyan'])):
        cube(tabs, mat('mc_tab%d' % i, c, rough=0.5, emit=0.15), (0.03, 0.0, 0.14 + i*0.14), (0.07, 0.10, 0.09), index=index)
    for sx, nm in ((-1, 'al'), (1, 'ar')):
        a = reg(E, nm, empty(nm, body, (sx*0.44, 0, 0.78)))
        cube(a, dark, (sx*0.02, 0, -0.24), (0.12, 0.12, 0.50), rot=(0, sx*-6, 0), index=index, bevel=0.03)
        cube(a, cover, (sx*0.04, -0.02, -0.52), (0.19, 0.19, 0.17), index=index, bevel=0.04)
    head = reg(E, 'head', empty('head', body, (0, -0.02, 0.92)))
    cube(head, dark, (0, 0, 0.04), (0.16, 0.16, 0.08), index=index)                                     # neck
    blk = cube(head, wood, (0, 0, 0.17), (0.46, 0.40, 0.18), index=index, bevel=0.025)                  # stamp block
    reg(E, 'padp', cube(head, pad, (0, 0, 0.075), (0.42, 0.36, 0.02), index=index))                    # glowing ink pad underneath
    prim('cylinder', head, wood, (0, 0, 0.31), (1, 1, 1), index=index, smooth=True, vertices=16, radius=0.05, depth=0.12)
    prim('uv_sphere', head, mat('mc_knob', (150, 104, 74), rough=0.5), (0, 0, 0.40), (1, 1, 0.8), index=index, smooth=True, radius=0.085, segments=16, ring_count=8)
    for ex in (-0.09, 0.09): cube(head, eye, (ex, -0.205, 0.18), (0.08, 0.012, 0.03), index=index)
    # payloads: template square (attack) + three summoned keycaps + loose pages (death)
    sq = reg(E, 'square', empty('square', root, (0, -0.62, 0.012))); sqm = glow_mat('mc_sq', P['amber'], 1.4, 0.9); E['mats']['sq'] = sqm
    for (x, y, w, h) in ((0, 0.25, 0.54, 0.035), (0, -0.25, 0.54, 0.035), (0.25, 0, 0.035, 0.54), (-0.25, 0, 0.035, 0.54)): cube(sq, sqm, (x, y, 0), (w, h, 0.01), index=index)
    keys = reg(E, 'keys', empty('keys', body, (0.0, -0.1, 0.5))); kb = mat('mc_kc', P['indigo'], rough=0.35)
    kt = tex_mat('mc_kt', EV5+'tex/v3/keyH_A.png', emit=1.1)
    for i in range(3):
        k = reg(E, 'key%d' % i, empty('key%d' % i, keys)); cube(k, kb, (0, 0, 0), (0.16, 0.16, 0.08), index=index, bevel=0.02)
        plane_tex(k, kt, (0, 0, 0.041), 0.14, 0.14, rot=(0, 0, 0), index=index)
    pg = reg(E, 'loose', empty('loose', root))
    for i in range(6): reg(E, 'pg%d' % i, cube(pg, paper, (0, 0, 0.5), (0.20, 0.27, 0.006), index=index))
    root.scale = (MACRO_S,)*3   # fits the 192 px cell (about 1.45x Noor; the bible's 2.2x does not fit the shared cell)
    all_index(E); pose(E, 'idle', 0); return E

def pose_macro(E, anim, k):
    n = NF(E, anim); ph = tau(k, n); m = E['mats']
    show(E['parts']['square'], False); show(E['parts']['keys'], False); show(E['parts']['loose'], False)
    pv = 0.8
    if anim == 'idle':
        off(E, 'body', (0, 0, 0.012*math.sin(ph))); off(E, 'head', (0, 0, 0.02*math.sin(ph + 0.6)), r=(3*math.sin(ph), 0, 0))
        off(E, 'pages', s=(1, 1 + 0.08*math.sin(ph*2), 1)); off(E, 'tabs', r=(0, 0, 4*math.sin(ph)))
        off(E, 'al', r=(4*math.sin(ph), 0, 0)); off(E, 'ar', r=(-4*math.sin(ph), 0, 0))
    elif anim == 'move':   # heavy steps, tabs sway
        off(E, 'll', (0, -0.06*math.sin(ph), 0.05*max(0, math.sin(ph)))); off(E, 'lr', (0, 0.06*math.sin(ph), 0.05*max(0, -math.sin(ph))))
        off(E, 'body', (0, 0, 0.02*abs(math.sin(ph))), r=(4, 4*math.sin(ph), 0)); off(E, 'tabs', r=(0, 10*math.sin(ph + 1), 0))
        off(E, 'al', r=(18*math.sin(ph), 0, 0)); off(E, 'ar', r=(-18*math.sin(ph), 0, 0)); off(E, 'head', r=(0, 0, 3*math.sin(ph)))
    elif anim == 'attack':   # tell: stamp head lifts high, arms grip it, ink pad glows; slam on f4
        lift = [0.25, 0.55, 0.85, 1.0, 0.0, 0.0, 0.1, 0.0][k]
        if k <= 3:
            off(E, 'head', (0, 0.02*lift, 0.22*lift), r=(-12*lift, 0, 0)); off(E, 'body', r=(-6*lift, 0, 0))
            off(E, 'al', r=(-150*lift, 0, -10*lift)); off(E, 'ar', r=(-150*lift, 0, 10*lift))
        else:
            u = [1.0, 0.75, 0.4, 0.1][k-4]
            off(E, 'head', (0, -0.42*u, -0.55*u), r=(70*u, 0, 0)); off(E, 'body', r=(14*u, 0, 0)); off(E, 'al', r=(-70*u, 0, 0)); off(E, 'ar', r=(-70*u, 0, 0))
            show(E['parts']['square'], True); set_fade(m['sq'], [0.95, 0.8, 0.6, 0.35][k-4])
        pv = [1.2, 1.8, 2.5, 3.2, 3.6, 2.2, 1.4, 1.0][k]
        set_emit(m['eye'], [1.4, 1.8, 2.2, 2.6, 2.0, 1.6, 1.3, 1.2][k])
    elif anim == 'summon':   # binder flips open, three keycaps fly out, closes
        o = [0.3, 0.7, 1.0, 1.0, 1.0, 1.0, 0.6, 0.1][k]; off(E, 'hinge', r=(0, 0, -115*o)); off(E, 'body', r=(-4*o, 0, 0))
        off(E, 'al', r=(-40*o, 0, -30*o)); off(E, 'ar', r=(-40*o, 0, 30*o))
        if 2 <= k <= 6:
            show(E['parts']['keys'], True); u = (k-2)/4.0
            for i in range(3):
                a = (i-1)*0.9; kk = E['parts']['key%d' % i]
                kk.location = Vector((math.sin(a)*0.65*u, -0.45*u - 0.1, 0.25 + 0.55*math.sin(math.pi*min(1, u*1.2)) - 0.35*u)); kk.rotation_euler = Euler((_r(50 + 200*u), _r(60*u*(i-1)), _r(90*u)))
        pv = 1.0 + 1.2*o
    elif anim == 'hurt':
        off(E, 'body', (0, 0.05*[1, .5, .1][k], 0), r=([-8, -4, -1][k], 0, [4, -3, 0][k])); off(E, 'head', r=([-14, -6, 0][k], 0, 0)); pv = [0.2, 0.6, 0.8][k]
        off(E, 'hinge', r=(0, 0, [-25, -10, 0][k]))
    elif anim == 'death':   # rings spring open, pages fan out across the floor, body sinks
        t = min(1.0, k/4.0); off(E, 'hinge', r=(0, 0, -150*ease(t*1.5))); off(E, 'body', (0, 0.0, -0.18*t), r=(-10*t, 0, 0)); off(E, 'head', (0, 0.1*t, -0.12*t), r=(-35*t, 0, 0))
        off(E, 'al', r=(0, 0, -30*t)); off(E, 'ar', r=(0, 0, 30*t)); show(E['parts']['loose'], True)
        for i in range(6):
            a = tau(i, 6) + 0.4; r_ = 0.25 + 0.45*ease(t); pg = E['parts']['pg%d' % i]
            pg.location = Vector((r_*math.cos(a), r_*math.sin(a)*0.8 - 0.1, 0.55*(1-ease(t)) + 0.02 + 0.15*math.sin(math.pi*t)))
            pg.rotation_euler = Euler((_r(30*(1-t)), _r(20*(1-t)*(i % 2*2-1)), a))
        pv = 0.8*(1-t); set_emit(m['eye'], 1.2*(1-t))
    m['pad'].node_tree.nodes['Emission'].inputs[1].default_value = pv; set_fade(m['pad'], 1.0)

# ======================= READ RECEIPT (double tick on a lamp-post with a lantern eye) =======================
def build_receipt(index=14):
    E = _new('receipt', index); root = E['root']
    slate = mat('rr_slate', P['slate'], rough=0.4, metal=0.3)
    tick = mat('rr_tick', (150, 162, 178), rough=0.35, emit=0.0, emit_rgb=P['mint']); E['mats']['tick'] = tick
    prim('cylinder', root, slate, (0, 0, 0.015), (1, 1, 1), index=index, smooth=True, vertices=32, radius=0.2, depth=0.03)
    body = reg(E, 'body', empty('body', root, (0, 0, 0.03)))
    prim('cylinder', body, slate, (0, 0, 0.30), (1, 1, 1), index=index, smooth=True, vertices=12, radius=0.022, depth=0.6)
    for nm, x in (('tk1', -0.17), ('tk2', 0.06)):
        t = reg(E, nm, empty(nm, body, (x, 0, 0.42)))
        cube(t, tick, (-0.075, 0, 0.13), (0.075, 0.06, 0.30), rot=(0, -32, 0), index=index, bevel=0.02)
        cube(t, tick, (0.14, 0, 0.36), (0.075, 0.06, 0.80), rot=(0, 22, 0), index=index, bevel=0.02)
    lan = reg(E, 'lantern', empty('lantern', body, (-0.02, -0.07, 0.86)))
    prim('cylinder', lan, slate, (0, 0, -0.03), (1, 1, 1), index=index, vertices=6, radius=0.006, depth=0.06)
    cube(lan, slate, (0, 0, -0.07), (0.11, 0.11, 0.02), index=index); cube(lan, slate, (0, 0, -0.22), (0.12, 0.12, 0.02), index=index)
    eye = mat('rr_eye', P['ice'], rough=0.3, emit=1.4, emit_rgb=(210, 240, 248)); E['mats']['eye'] = eye
    prim('uv_sphere', lan, eye, (0, 0, -0.145), (1, 1, 1.2), index=index, smooth=True, radius=0.05, segments=16, ring_count=8)
    for sx in (-1, 1):
        for sy in (-1, 1): prim('cylinder', lan, slate, (sx*0.05, sy*0.05, -0.145), (1, 1, 1), index=index, vertices=6, radius=0.006, depth=0.15)
    beam = reg(E, 'beam', empty('beam', lan, (0, 0, -0.145))); bm = glow_mat('rr_beam', P['ice'], 2.0, 0.9); E['mats']['beam'] = bm
    prim('cylinder', beam, bm, (0, -0.32, -0.05), (1, 1, 1), (82, 0, 0), index=index, vertices=8, radius=0.012, depth=0.64)
    all_index(E); pose(E, 'idle', 0); return E

def pose_receipt(E, anim, k):
    n = NF(E, anim); ph = tau(k, n); m = E['mats']; show(E['parts']['beam'], False)
    te = 0.0; ee = 1.4
    if anim == 'idle':
        off(E, 'lantern', r=(0, 9*math.sin(ph), 0)); off(E, 'tk1', r=(0, 2*math.sin(ph), 0)); off(E, 'tk2', r=(0, 2*math.sin(ph + 0.8), 0))
    elif anim == 'move':   # glides with a lean, lantern trails
        off(E, 'body', (0, 0, 0.015*abs(math.sin(ph))), r=(8, 0, 4*math.sin(ph))); off(E, 'lantern', r=(-14, 6*math.sin(ph), 0))
    elif anim == 'attack':   # ticks tilt towards Noor, lantern brightens, thin read-beam on f4
        tl = [0.3, 0.6, 0.9, 1.0, 1.0, 0.7, 0.4, 0.1][k]; off(E, 'tk1', r=(14*tl, 0, 0)); off(E, 'tk2', r=(14*tl, 0, 0)); off(E, 'lantern', r=(18*tl, 0, 0))
        ee = [1.8, 2.4, 3.0, 3.6, 3.2, 2.2, 1.6, 1.4][k]; te = [0.2, 0.5, 0.8, 1.1, 1.2, 0.8, 0.4, 0.1][k]
        if 4 <= k <= 5: show(E['parts']['beam'], True); set_fade(m['beam'], [0.95, 0.5][k-4])
    elif anim == 'hurt':
        off(E, 'tk1', r=(0, [12, -6, 2][k], 0)); off(E, 'tk2', r=(0, [-10, 6, -2][k], 0)); off(E, 'lantern', r=(0, [20, -10, 3][k], 0)); ee = [0.4, 1.0, 1.3][k]
    elif anim == 'death':   # the ticks fold flat like a closed book, the lantern dims
        t = ease(min(1.0, k/4.0)); off(E, 'tk1', (0, 0, -0.36*t), r=(-85*t, 0, 0)); off(E, 'tk2', (0, 0, -0.36*t), r=(-85*t, 0, 0)); off(E, 'lantern', (0, 0, -0.5*t), r=(0, 30*t, 0))
        ee = 1.4*(1-t)
    set_emit(m['tick'], te); set_emit(m['eye'], ee)

# ======================= SLA HOUND (stopwatch hound, progress-bar tail) =======================
def build_hound(index=16):
    E = _new('hound', index); root = E['root']
    slate = mat('hd_body', (70, 80, 110), rough=0.4, metal=0.35); dark = mat('hd_dark', (26, 30, 46), rough=0.5)
    chrome = mat('hd_chrome', (190, 196, 208), rough=0.25, metal=0.9)
    body = reg(E, 'body', empty('body', root, (0, 0, 0.27)))
    prim('uv_sphere', body, slate, (0, 0.02, 0), (0.62, 1.0, 0.55), index=index, smooth=True, radius=0.24, segments=24, ring_count=12)
    dial = reg(E, 'dial', empty('dial', body, (0, 0.03, 0.12)))
    prim('cylinder', dial, chrome, (0, 0, 0), (1, 1, 1), index=index, smooth=True, vertices=32, radius=0.15, depth=0.04)
    dm = tex_mat('hd_dial', EV6+'tex/dial.png', emit=0.35, rough=0.3); E['mats']['dial'] = dm
    dface = prim('circle', dial, dm, (0, 0, 0.021), (1, 1, 1), (0, 0, 90), index=index, vertices=32, radius=0.135, fill_type='NGON')
    uv = dface.data.uv_layers.new()
    for li, l in enumerate(dface.data.loops):
        co = dface.data.vertices[l.vertex_index].co; uv.data[li].uv = (co.x/0.27 + 0.5, co.y/0.27 + 0.5)
    hand = reg(E, 'hand', empty('hand', dial, (0, 0, 0.026))); cube(hand, mat('hd_hand', P['coral'], rough=0.4, emit=0.6), (0, -0.055, 0), (0.012, 0.11, 0.008), index=index)
    head = reg(E, 'head', empty('head', body, (0, -0.26, 0.10)))
    prim('uv_sphere', head, slate, (0, -0.03, 0), (0.85, 1.05, 0.8), index=index, smooth=True, radius=0.11, segments=16, ring_count=8)
    cube(head, dark, (0, -0.15, -0.02), (0.09, 0.08, 0.06), index=index, bevel=0.02)                       # snout
    prim('cylinder', head, chrome, (0, -0.01, 0.10), (1, 1, 1), index=index, smooth=True, vertices=12, radius=0.025, depth=0.06)   # stopwatch crown
    prim('torus', head, chrome, (0, -0.01, 0.15), (1, 1, 1), (90, 0, 0), index=index, major_radius=0.03, minor_radius=0.008, major_segments=16, minor_segments=6)
    eye = mat('hd_eye', P['ice'], emit=1.2, rough=0.3); E['mats']['eye'] = eye
    for ex in (-0.045, 0.045): prim('uv_sphere', head, eye, (ex, -0.11, 0.03), (1, 1, 1), index=index, radius=0.016, segments=10, ring_count=6)
    for sx, nm in ((-1, 'earl'), (1, 'earr')):
        e = reg(E, nm, empty(nm, head, (sx*0.06, 0.0, 0.07))); prim('cone', e, dark, (0, 0.0, 0.05), (0.5, 1, 1), (-10, 0, 0), index=index, vertices=4, radius1=0.05, radius2=0.0, depth=0.12)
    for nm, (x, y) in (('lfl', (-0.08, -0.15)), ('lfr', (0.08, -0.15)), ('lbl', (-0.08, 0.18)), ('lbr', (0.08, 0.18))):
        l = reg(E, nm, empty(nm, body, (x, y, -0.04))); prim('cylinder', l, dark, (0, 0, -0.11), (1, 1, 1), index=index, vertices=8, radius=0.022, depth=0.22)
        prim('uv_sphere', l, dark, (0, -0.01, -0.22), (1, 1.3, 0.6), index=index, radius=0.03, segments=8, ring_count=6)
    tail = reg(E, 'tail', empty('tail', body, (0, 0.24, 0.05))); tm = glow_mat('hd_tail', P['amber'], 1.0); E['mats']['tail'] = tm
    cube(tail, dark, (0, 0.10, 0.05), (0.05, 0.22, 0.05), rot=(-25, 0, 0), index=index)
    cube(tail, tm, (0, 0.08, 0.04), (0.035, 0.15, 0.054), rot=(-25, 0, 0), index=index)
    ring = reg(E, 'ring', prim('torus', root, glow_mat('hd_ring', P['coral'], 1.6), (0, 0, 0.02), (1, 1, 0.25), index=index, major_radius=0.3, minor_radius=0.012, major_segments=48, minor_segments=6))
    E['mats']['ring'] = ring.data.materials[0]
    root.scale = (1.2,)*3
    all_index(E); pose(E, 'idle', 0); return E

def pose_hound(E, anim, k):
    n = NF(E, anim); ph = tau(k, n); m = E['mats']; show(E['parts']['ring'], False)
    tv = 1.0; tcol = P['amber']; dv = 0.35; hr = 0
    def legs(a, lift=0.03):
        for nm, s in (('lfl', 1), ('lbr', 1), ('lfr', -1), ('lbl', -1)):
            off(E, nm, (0, 0, lift*max(0, s*math.sin(ph))), r=(a*s*math.sin(ph), 0, 0))
    if anim == 'idle':   # asleep: low, head down, dial stopped, tail dim
        off(E, 'body', (0, 0, -0.08 + 0.006*math.sin(ph)), s=(1, 1, 1 + 0.02*math.sin(ph))); off(E, 'head', (0, 0, -0.06), r=(18, 0, 0))
        for nm in ('lfl', 'lfr', 'lbl', 'lbr'): off(E, nm, (0, 0, 0.07), r=(0, 0, 0), s=(1, 1, 0.55))
        off(E, 'earl', r=(30, 0, 0)); off(E, 'earr', r=(30, 0, 0)); tv = 0.25; dv = 0.12; set_emit(m['eye'], 0.15)
    elif anim == 'move':   # fast trot, dial hand sweeping
        legs(32); off(E, 'body', (0, 0, 0.02*abs(math.sin(ph*2))), r=(3*math.sin(ph*2), 0, 0)); off(E, 'tail', r=(0, 0, 18*math.sin(ph))); hr = -60*k
        off(E, 'head', r=(-4 + 4*math.sin(ph*2), 0, 0)); set_emit(m['eye'], 1.2)
    elif anim == 'attack':   # tell: dial flashes the last second, ears flatten, crouch; bite lunge
        c = [0.3, 0.6, 0.9, 1.0, 0.0, 0.0, 0.0, 0.0][k]; off(E, 'earl', r=(60*c, 0, 0)); off(E, 'earr', r=(60*c, 0, 0))
        if k <= 3: off(E, 'body', (0, 0.04*c, -0.05*c), r=(-6*c, 0, 0)); off(E, 'head', (0, 0.02*c, -0.02*c), r=(10*c, 0, 0))
        else:
            u = [0.7, 1.0, 0.5, 0.15][k-4]; off(E, 'body', (0, -0.28*u, 0.03*u), r=(8*u, 0, 0)); off(E, 'head', (0, -0.05*u, 0.02*u), r=(-22*u, 0, 0))
            for nm in ('lfl', 'lfr'): off(E, nm, r=(-40*u, 0, 0))
            for nm in ('lbl', 'lbr'): off(E, nm, r=(35*u, 0, 0))
        dv = [0.6, 1.0, 1.4, 1.8, 1.2, 0.8, 0.5, 0.35][k]; tcol = P['coral'] if k <= 5 else P['amber']; hr = -330 + 6*k
    elif anim == 'breach':   # sits and howls a coral ring
        s_ = [0.5, 1.0, 1.0, 1.0, 1.0, 0.6][k]; off(E, 'body', (0, 0.05*s_, -0.02*s_), r=(-28*s_, 0, 0)); off(E, 'head', (0, 0.0, 0.04*s_), r=(-35*s_, 0, 0))
        for nm in ('lbl', 'lbr'): off(E, nm, r=(70*s_, 0, 0))
        if 2 <= k <= 5:
            r_ = E['parts']['ring']; show(r_, True); u = (k-2)/3.0; r_.scale = (0.8 + 1.2*u, 0.8 + 1.2*u, 0.25); set_fade(m['ring'], 0.9*(1-u*0.8))
        tcol = P['coral']; dv = 1.5; hr = 0
    elif anim == 'hurt':
        off(E, 'body', (0, 0.05*[1, .5, .1][k], 0), r=([-10, -5, -1][k], 0, [6, -4, 0][k])); off(E, 'head', r=([-20, -8, 0][k], 0, 0)); dv = [1.4, 0.7, 0.4][k]
    elif anim == 'death':   # winds down and stops at 0:00
        t = ease(min(1.0, k/4.0)); off(E, 'body', (0, 0, -0.14*t), r=(0, 70*t, 0)); off(E, 'head', r=(25*t, 0, 0)); tv = 1 - t; dv = 0.35*(1-t); hr = -360*t
        for nm in ('lfl', 'lfr', 'lbl', 'lbr'): off(E, nm, r=(0, 30*t, 0))
    E['parts']['hand'].rotation_euler = Euler((0, 0, _r(hr)))
    m['tail'].node_tree.nodes['Emission'].inputs[0].default_value = (*L3(tcol), 1); set_fade(m['tail'], max(0.05, tv)); set_emit(m['dial'], dv)

# ======================= THE THREAD (chain of stitched envelopes) =======================
def _envelope(E, parent, w, h, tex, index, flap_key=None):
    paper = tex_mat('th_'+os.path.basename(tex), tex, emit=0.12, rough=0.75); E['mats']['paper'] = paper
    env = cube(parent, mat('th_edge', (200, 192, 172), rough=0.8), (0, 0, 0), (w, 0.03, h), index=index, bevel=0.006)
    plane_tex(parent, paper, (0, -0.016, 0), w*0.99, h*0.99, index=index)
    back = plane_tex(parent, paper, (0, 0.016, 0), w*0.99, h*0.99, rot=(90, 0, 180), index=index)
    fl = reg(E, flap_key or 'flap', empty('flap', parent, (0, 0.017, h/2)))
    import bmesh
    me = bpy.data.meshes.new('flap'); bm_ = bmesh.new(); vs = [bm_.verts.new(v) for v in ((-w/2, 0, 0), (w/2, 0, 0), (0, 0, -h*0.55))]; bm_.faces.new(vs); bm_.to_mesh(me); bm_.free()
    fo = bpy.data.objects.new('flap', me); bpy.context.scene.collection.objects.link(fo); fo.parent = fl; fo.data.materials.append(mat('th_flap', (210, 200, 180), rough=0.8)); fo.pass_index = index
    fo.modifiers.new('s', 'SOLIDIFY').thickness = 0.006
    return env

def _thread_common(name, index, w, h, tex, seal=False, line=True):
    E = _new(name, index); root = E['root']
    fl = reg(E, 'float', empty('float', root, (0, 0, 0.12 + h*0.3)))
    root.scale = (1.3,)*3
    tilt = reg(E, 'tilt', empty('tilt', fl)); tilt.rotation_euler = (_r(-58), 0, 0); E['rest']['tilt'] = (tilt.location.copy(), tilt.rotation_euler.copy(), tilt.scale.copy())
    _envelope(E, tilt, w, h, tex, index)
    glow = glow_mat(name+'_glow', P['coral'], 0.0, 0.0); E['mats']['glow'] = glow
    reg(E, 'aura', cube(tilt, glow, (0, 0, 0), (w*1.12, 0.012, h*1.15), index=index))
    if line:   # the coral quote-line stitched through (runs along the chain axis, front-back)
        lm = glow_mat(name+'_line', P['coral'], 1.3); E['mats']['line'] = lm
        reg(E, 'line', prim('cylinder', fl, lm, (0, 0.0, 0), (1, 1, 1), (90, 0, 0), index=index, vertices=6, radius=0.007, depth=0.56))
    if seal:
        sm = mat('th_seal', (190, 50, 64), rough=0.35, emit=0.5, emit_rgb=(232, 96, 106)); E['mats']['seal'] = sm
        reg(E, 'seal', prim('cylinder', tilt, sm, (0, -0.03, h*0.12), (1, 1, 1), (90, 0, 0), index=index, smooth=True, vertices=20, radius=0.055, depth=0.02))
    spark = reg(E, 'spark', empty('spark', fl)); spm = glow_mat(name+'_spark', P['coral'], 3.0); E['mats']['spark'] = spm
    for i in range(6):
        a = tau(i, 6); prim('cube', spark, spm, (0.06*math.cos(a), 0.06*math.sin(a), 0.03*math.sin(2*a)), (0.02, 0.02, 0.02), index=index, size=1)
    all_index(E); return E

def build_thread_seg(index=17): E = _thread_common('thread_seg', index, 0.42, 0.28, EV6+'tex/env_seg.png'); pose(E, 'idle', 0); return E
def build_thread_head(index=17): E = _thread_common('thread_head', index, 0.52, 0.34, EV6+'tex/env_head.png', seal=True); pose(E, 'idle', 0); return E
def build_thread_tail(index=17): E = _thread_common('thread_tail', index, 0.28, 0.19, EV6+'tex/env_tail.png', line=False); pose(E, 'idle', 0); return E

QUOTE_COL = [P['coral'], P['lav'], P['ice'], P['magenta']]
def pose_thread(E, anim, k):
    n = NF(E, anim); ph = tau(k, n); m = E['mats']; show(E['parts']['spark'], False); set_fade(m['glow'], 0.0)
    head = E['name'] == 'thread_head'; fo = 8
    if anim == 'idle':
        off(E, 'float', (0, 0, 0.02*math.sin(ph))); fo = 8 + 10*max(0, math.sin(ph))
    elif anim == 'move':   # sine-wave follow (the engine offsets the phase per segment)
        off(E, 'float', (0.03*math.sin(ph), 0, 0.03*abs(math.sin(ph))), r=(0, 6*math.sin(ph), 12*math.sin(ph))); fo = 10
    elif anim == 'attack':
        if head:   # seal glows, flap opens; lunge on f4
            o = [0.3, 0.6, 0.9, 1.0, 1.0, 0.6, 0.3, 0.1][k]; fo = 10 + 80*o
            u = [0, 0, 0, 0, 1.0, 0.6, 0.3, 0.1][k]; off(E, 'float', (0, -0.32*u, 0.04*o), r=(-10*o + 16*u, 0, 0))
            set_emit(m['seal'], [1.0, 1.8, 2.6, 3.4, 3.0, 2.0, 1.2, 0.5][k])
        elif E['name'] == 'thread_tail':
            o = [0.2, 0.5, 0.8, 1.0, 0.4, 0.2, 0.1, 0.0][k]; fo = 10 + 60*o; u = [0, 0, 0, 0, 1, .6, .3, 0][k]; off(E, 'float', (0, -0.2*u, 0), r=(0, 0, 25*u))
        else:      # quote: glows with an earlier enemy's accent (coral here; tint per quote in-engine), pulse on f4
            g = [0.2, 0.45, 0.7, 0.9, 1.0, 0.6, 0.3, 0.1][k]; set_fade(m['glow'], g*0.55); m['glow'].node_tree.nodes['Emission'].inputs[1].default_value = 2.0*g
            off(E, 'float', (0, 0, 0.03*g), s=(1 + 0.08*(k == 4), 1, 1 + 0.08*(k == 4)))
    elif anim == 'split':   # quote-line snaps with a small coral spark
        show(E['parts']['spark'], 1 <= k <= 3); sp = E['parts']['spark']; u = min(1, k/3.0); sp.scale = (0.6 + 1.6*u,)*3; set_fade(m['spark'], 1 - 0.7*u)
        if 'line' in E['parts']: off(E, 'line', s=(1, 1, [1, 0.5, 0.25, 0.1, 0.1, 0.1][k]))
        off(E, 'float', (0, 0, [0, 0.06, 0.04, 0.02, 0.0, 0][k]), r=(0, [0, 18, -10, 5, -2, 0][k], 0))
    elif anim == 'hurt':
        off(E, 'float', (0, 0.04*[1, .5, .1][k], 0), r=([-16, -8, -2][k], 0, [10, -6, 0][k])); fo = [60, 30, 10][k]
    elif anim == 'death':   # lies down flat ("answered")
        t = ease(min(1.0, k/4.0)); off(E, 'float', (0, 0.0, -0.10*t), r=(-30*t, 0, 0)); fo = 8*(1-t)
        if 'line' in E['parts']: set_fade(m['line'], 1 - t)
    E['parts']['flap'].rotation_euler = Euler((_r(-fo), 0, 0))

# ======================= DRAFT PICKUP (folded paper plane over a warm ring) =======================
def build_draft(index=12):
    import bmesh
    E = _new('draft', index); root = E['root']
    fl = reg(E, 'float', empty('float', root, (0, 0, 0.40)))
    pm = tex_mat('dr_paper', EV6+'tex/paper_plane.png', emit=0.35, rough=0.7)
    me = bpy.data.meshes.new('plane'); bm_ = bmesh.new()
    # paper plane: nose at -Y, two wings + a keel fold
    V = [(0, -0.20, 0.0), (-0.17, 0.16, 0.02), (-0.02, 0.16, 0.0), (0, 0.16, -0.06), (0.02, 0.16, 0.0), (0.17, 0.16, 0.02)]
    vs = [bm_.verts.new(v) for v in V]
    for f in ((0, 1, 2), (0, 2, 3), (0, 3, 4), (0, 4, 5)): bm_.faces.new([vs[i] for i in f])
    uvl = bm_.loops.layers.uv.new()
    for f in bm_.faces:
        for l in f.loops: l[uvl].uv = ((l.vert.co.x + 0.18)/0.36, (l.vert.co.y + 0.2)/0.36)
    bm_.to_mesh(me); bm_.free()
    po = bpy.data.objects.new('paperplane', me); bpy.context.scene.collection.objects.link(po); po.parent = fl; po.data.materials.append(pm); po.pass_index = index
    po.modifiers.new('s', 'SOLIDIFY').thickness = 0.004; reg(E, 'plane', po); po.rotation_euler = (_r(8), 0, _r(25)); E['rest']['plane'] = (po.location.copy(), po.rotation_euler.copy(), po.scale.copy())
    rm = glow_mat('dr_ring', P['amber'], 1.3, 0.9); E['mats']['ring'] = rm
    reg(E, 'ring', prim('torus', root, rm, (0, 0, 0.012), (1, 1, 0.3), index=index, major_radius=0.20, minor_radius=0.008, major_segments=48, minor_segments=6))
    reg(E, 'ring2', prim('torus', root, rm, (0, 0, 0.012), (1, 1, 0.3), index=index, major_radius=0.12, minor_radius=0.005, major_segments=40, minor_segments=6))
    root.scale = (1.5,)*3
    all_index(E); pose(E, 'idle', 0); return E

def pose_draft(E, anim, k):
    n = NF(E, anim); ph = tau(k, n)
    off(E, 'float', (0, 0, 0.035*math.sin(ph)), r=(0, 0, 0)); off(E, 'plane', r=(4*math.sin(ph), 6*math.sin(ph + 1), 10*math.sin(ph*0.5)))
    off(E, 'ring2', s=(1 + 0.25*((k % n)/n), 1 + 0.25*((k % n)/n), 1)); set_fade(E['mats']['ring'], 0.75 + 0.25*math.sin(ph))

BUILD.update(macro=build_macro, receipt=build_receipt, hound=build_hound, thread_seg=build_thread_seg, thread_head=build_thread_head, thread_tail=build_thread_tail, draft=build_draft)
POSE.update(macro=pose_macro, receipt=pose_receipt, hound=pose_hound, thread_seg=pose_thread, thread_head=pose_thread, thread_tail=pose_thread, draft=pose_draft)

# ======================= P2 cast: Apology Moths, The 4.9 (frame + star), the NEVER tile, Dez =======================
def atex_mat(name, path, emit=1.0, alpha=1.0, tint=None):
    """emissive alpha-textured card with a 'fade' value (wings, stars, word tiles)"""
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL': nt.nodes.remove(n)
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(path, check_existing=True)
    b = nt.nodes.new('ShaderNodeBsdfPrincipled'); nt.links.new(t.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = 0.7
    nt.links.new(t.outputs['Color'], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = emit
    v = nt.nodes.new('ShaderNodeValue'); v.name = 'fade'; v.outputs[0].default_value = alpha
    ml = nt.nodes.new('ShaderNodeMath'); ml.operation = 'MULTIPLY'; nt.links.new(t.outputs['Alpha'], ml.inputs[0]); nt.links.new(v.outputs[0], ml.inputs[1])
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(ml.outputs[0], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(b.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], nt.nodes['Material Output'].inputs[0]); m.blend_method = 'BLEND'; m['glow'] = 1; m['emitnode'] = b.name
    return m
def aset_emit(m, v): m.node_tree.nodes[m['emitnode']].inputs['Emission Strength'].default_value = v

# ---- Apology Moths: a loose swarm of 8 sticky-note moths (1 direction) ----
MOTH_HOME = [(-0.30, 0.05, 0.62), (-0.12, -0.10, 0.80), (0.10, 0.02, 0.70), (0.30, -0.06, 0.58), (-0.22, 0.12, 0.42), (0.02, -0.14, 0.48), (0.22, 0.10, 0.88), (0.0, 0.08, 1.0)]
def build_moths(index=18):
    E = _new('moths', index); root = E['root']
    wm = atex_mat('mo_wing', EV6+'tex/moth_wing.png', emit=0.55); E['mats']['wing'] = wm
    bm = mat('mo_body', (120, 96, 80), rough=0.7)
    dm = glow_mat('mo_dust', P['warm'], 2.0, 1.0); E['mats']['dust'] = dm
    for i, h in enumerate(MOTH_HOME):
        m = reg(E, 'm%d' % i, empty('m%d' % i, root, h)); s = 0.85 + 0.3*((i*37) % 10)/10
        m.scale = (s, s, s); E['rest']['m%d' % i] = (m.location.copy(), m.rotation_euler.copy(), m.scale.copy())
        prim('cylinder', m, bm, (0, 0, 0), (1, 1, 1), (90, 0, 0), index=index, vertices=6, radius=0.012, depth=0.09)
        for sx in (-1, 1):
            w = reg(E, 'w%d%s' % (i, 'l' if sx < 0 else 'r'), empty('w', m, (0, 0, 0)))
            p = plane_tex(w, wm, (sx*0.07, 0, 0), 0.14, 0.14, rot=(0, 0, 0 if sx > 0 else 180), index=index)
    dust = reg(E, 'dust', empty('dust', root)); rnd = random.Random(2)
    for i in range(18): prim('cube', dust, dm, (rnd.uniform(-0.35, 0.35), rnd.uniform(-0.2, 0.2), rnd.uniform(0.3, 0.95)), (1, 1, 1), index=index, size=0.018)
    root.scale = (1.15,)*3
    all_index(E); pose(E, 'idle', 0); return E
def pose_moths(E, anim, k):
    n = NF(E, anim); ph = tau(k, n); show(E['parts']['dust'], False); m = E['mats']
    for i in range(8):
        a = ph + i*0.8; flap = 35 + 35*math.sin(a*2)
        hx, hy, hz = MOTH_HOME[i]; d = (0.03*math.sin(a), 0.02*math.cos(a), 0.03*math.sin(a + 1)); rz = 0
        if anim == 'move': d = (0.05*math.sin(a) , -0.08*((k + i) % n)/n, 0.04*math.sin(a*2)); flap = 30 + 45*math.sin(a*3)
        elif anim == 'attack':
            if k <= 3: flap = 85*min(1, (k + 1)/3); d = (0, 0.04*k/3, 0.06*k/3)
            else:
                u = [0.6, 1.0, 0.6, 0.2][k-4]; flap = [80, 70, 40, 30][k-4]; d = (-hx*0.5*u, -0.45*u, -(hz - 0.2)*u)
            aset_emit(m['wing'], [0.7, 0.9, 1.1, 1.3, 1.1, 0.9, 0.7, 0.55][k])
        elif anim == 'hurt': d = (hx*0.5*[1, .6, .2][k], 0.05, 0.05*[1, .6, .2][k]); flap = 80
        elif anim == 'death':
            t = k/(n-1); flap = -10*t; rz = 0; d = (0, 0, -0.1*t)
            set_fade(m['wing'], 1 - t); show(E['parts']['dust'], k >= 2); set_fade(m['dust'], 1 - abs(t - 0.6)*1.5)
        elif anim == 'landed':
            hz2 = 0.05 + 0.04*(i % 3); d = (hx*0.4 - hx, hy*0.6 - hy, hz2 - hz); flap = 20 + 25*(0.5 + 0.5*math.sin(ph + i))
        off(E, 'm%d' % i, d, r=(0, 0, 18*math.sin(i*1.7) + rz))
        off(E, 'w%dl' % i, r=(0, -flap, 0)); off(E, 'w%dr' % i, r=(0, flap, 0))

# ---- The 4.9: dim scoreboard frame (1 direction); the stars are separate sprites (star49, star49x = cracked) ----
def build_the49(index=19):
    E = _new('the49', index); root = E['root']
    body = reg(E, 'body', empty('body', root, (0, 0, 0.62)))
    fm = mat('t49_frame', (70, 64, 52), rough=0.35, metal=0.7, emit=0.0)
    for (x, z, w, h) in ((0, 0.22, 0.86, 0.06), (0, -0.22, 0.86, 0.06), (-0.40, 0, 0.06, 0.5), (0.40, 0, 0.06, 0.5)): cube(body, fm, (x*1.15, 0, z*1.15), (w*1.15 if w > 0.5 else w, 0.08, h*1.15 if h > 0.3 else h), index=index, bevel=0.015)
    sm = tex_mat('t49_score', EV6+'tex/score49.png', emit=0.35); E['mats']['score'] = sm
    plane_tex(body, sm, (0, 0.0, 0), 0.84, 0.34, index=index)
    hm = glow_mat('t49_hum', (214, 176, 96), 1.0, 0.25); E['mats']['hum'] = hm
    reg(E, 'hum', cube(body, hm, (0, 0.02, 0), (0.92, 0.01, 0.56), index=index))
    bm = glow_mat('t49_beam', (255, 200, 130), 1.4, 0.45); E['mats']['beam'] = bm
    reg(E, 'beam', cube(root, bm, (0, -0.32, 0.02), (0.95, 0.42, 0.01), index=index))
    all_index(E); pose(E, 'idle', 0); return E
def pose_the49(E, anim, k):
    n = NF(E, anim); ph = tau(k, n); m = E['mats']; show(E['parts']['beam'], False); sv = 0.35
    if anim == 'idle': off(E, 'body', (0, 0, 0.02*math.sin(ph))); set_fade(m['hum'], 0.18 + 0.1*math.sin(ph))
    elif anim == 'move': off(E, 'body', (0, -0.03*math.sin(ph), 0.03*math.sin(ph*2)), r=(4*math.sin(ph), 0, 0))
    elif anim == 'attack':
        c = [0.3, 0.6, 0.9, 1.0, 1.0, 0.7, 0.4, 0.1][k]; off(E, 'body', (0, 0, 0.04*c), r=(-10*c, 0, 0)); sv = 0.35 + 1.4*c; set_fade(m['hum'], 0.2 + 0.5*c)
        if 4 <= k <= 6: show(E['parts']['beam'], True); set_fade(m['beam'], [0.5, 0.32, 0.15][k-4])
    elif anim == 'hurt': off(E, 'body', (0, 0.04*[1, .5, .1][k], 0), r=(0, 0, [6, -4, 0][k])); sv = [0.1, 0.2, 0.3][k]
    elif anim == 'death':
        t = k/(n-1); off(E, 'body', (0, 0, -0.5*ease(t)), r=(-70*ease(t), 0, 8*t)); sv = 0.35*(1-t); set_fade(m['hum'], 0.2*(1-t))
    set_emit(m['score'], sv)
def build_star49(index=19, cracked=False):
    E = _new('star49x' if cracked else 'star49', index); root = E['root']
    st = reg(E, 'star', empty('star', root, (0, 0, 0.75 if not cracked else 0.62)))
    sm = atex_mat('st_tex', EV6+'tex/'+('star_cracked.png' if cracked else 'star.png'), emit=1.2); E['mats']['star'] = sm
    plane_tex(st, sm, (0, 0, 0), 0.34, 0.34, index=index); plane_tex(st, sm, (0, 0.004, 0), 0.34, 0.34, rot=(90, 0, 180), index=index)
    pm = glow_mat('st_pool', (255, 210, 150), 0.8, 0.12); E['mats']['pool'] = pm
    reg(E, 'pool', prim('cylinder', root, pm, (0, 0, 0.005), (1, 1, 1), index=index, vertices=32, radius=0.17, depth=0.004)); show(E['parts']['pool'], False)   # pools = room lights, not in the sprite
    rm = glow_mat('st_ring', (255, 214, 150), 1.5, 0.8); E['mats']['ring'] = rm
    reg(E, 'ring', prim('torus', root, rm, (0, 0, 0.01), (1, 1, 0.3), index=index, major_radius=0.25, minor_radius=0.008, major_segments=40, minor_segments=6))
    all_index(E); pose(E, 'idle', 0); return E
def pose_star49(E, anim, k):
    n = NF(E, anim); ph = tau(k, n); m = E['mats']; show(E['parts']['ring'], False); ev = 1.2
    show(E['parts']['pool'], False)
    if anim in ('idle', 'move'): off(E, 'star', (0, 0, 0.03*math.sin(ph)), r=(0, 0, 25*math.sin(ph))); set_fade(m['pool'], 0.12 + 0.04*math.sin(ph))
    elif anim == 'attack':
        if k <= 3: off(E, 'star', (0, 0, 0.08*k/3), r=(0, 0, 90*k)); ev = 1.2 + 0.5*k
        else:
            u = [1.0, 0.6, 0.3, 0.1][k-4]; off(E, 'star', (0, 0, -0.6*u)); ev = 2.4*u + 1.0
            if k == 4: show(E['parts']['ring'], True)
    elif anim == 'hurt': ev = [0.3, 0.6, 0.9][k]; off(E, 'star', r=(0, 0, [20, -10, 0][k]))
    elif anim == 'death':   # falls, rings once, lies on the floor showing its line
        t = min(1.0, k/3.0); zz = E['rest']['star'][0].z; off(E, 'star', (0, -0.05*t, -(zz - 0.03)*ease(t)), r=(-90*ease(t), 0, 0))
        show(E['parts']['ring'], k == 3); ev = 1.2 if k < 3 else 0.9; set_fade(m['pool'], 0.12*(1 - t))
    aset_emit(m['star'], ev)

# ---- the NEVER tile (Fern phase 2): a painted word board that floats, cracks and shatters ----
def build_never(index=11):
    E = _new('never', index); root = E['root']; tm = tex_mat('nv_tex', EV6+'tex/sign_NEVER.png', emit=0.8); E['mats']['t'] = tm
    img = bpy.data.images.load(EV6+'tex/sign_NEVER.png', check_existing=True); ar = img.size[0]/img.size[1]; h = 0.30; w = h*ar
    b = reg(E, 'board', empty('board', root, (0, 0, 0.75)))
    for i in range(6):   # six shards that sit flush as one board until the break
        u0, u1 = i/6, (i+1)/6; me = bpy.data.meshes.new('nv%d' % i)
        me.from_pydata([(w*(u0-0.5), 0, -h/2), (w*(u1-0.5), 0, -h/2), (w*(u1-0.5), 0, h/2), (w*(u0-0.5), 0, h/2)], [], [(0, 1, 2, 3)])
        uv = me.uv_layers.new(); 
        for li, (uu, vv) in enumerate(((u0, 0), (u1, 0), (u1, 1), (u0, 1))): uv.data[li].uv = (uu, vv)
        o = bpy.data.objects.new('nv%d' % i, me); bpy.context.scene.collection.objects.link(o); o.parent = b; o.data.materials.append(tm)
        o.modifiers.new('s', 'SOLIDIFY').thickness = 0.03; reg(E, 's%d' % i, o)
    cm = glow_mat('nv_crack', P['ice'], 3.0, 1.0); E['mats']['crack'] = cm
    reg(E, 'crack', cube(b, cm, (0.02, -0.02, 0), (0.012, 0.004, h*0.9), rot=(0, 18, 0), index=index))
    all_index(E); pose(E, 'idle', 0); return E
def pose_never(E, anim, k):
    n = NF(E, anim); ph = tau(k, n); show(E['parts']['crack'], False); m = E['mats']
    if anim == 'idle': off(E, 'board', (0, 0, 0.03*math.sin(ph)), r=(0, 0, 4*math.sin(ph)))
    elif anim == 'hurt': show(E['parts']['crack'], True); off(E, 'board', (0.02*[1, -1, 0][k], 0, 0)); set_emit(m['t'], [1.4, 1.0, 0.8][k])
    elif anim == 'death':
        t = k/(n-1); show(E['parts']['crack'], k < 2); set_emit(m['t'], 0.8*(1-t) + 0.1)
        for i in range(6):
            a = (i - 2.5)*0.5; off(E, 's%d' % i, (a*0.35*t, -0.1*t, -0.55*t*t + 0.12*t*(i % 2)), r=(60*t*(i % 3 - 1), 90*t*(i - 2.5)/2.5, 30*t))
NEVER_ANIMS = {'idle': (4, 6), 'hurt': (3, 12), 'death': (6, 12)}

# ---- Dez Okafor (hub NPC, idle only, 4 dirs): Kenney mini-character male-c, recoloured, lanyard + QA clipboard ----
DEZ_H = 0.70
def build_dez(index=20):
    E = _new('dez', index); root = E['root']
    before = set(bpy.data.objects); bacts = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath='/workspace/games/_downloads/mini-characters/Models/GLB format/character-'+os.environ.get('DEZM','male-a')+'.glb')
    new = [o for o in bpy.data.objects if o not in before]; arm = [o for o in new if o.type == 'ARMATURE'][0]
    for o in new:
        if o.type in ('CAMERA', 'LIGHT') or (o.type == 'MESH' and o.parent is None): bpy.data.objects.remove(o, do_unlink=True)
    arm.parent = root; E['arm'] = arm
    bpy.context.view_layer.update(); hz0 = max((o.matrix_world @ Vector(c))[2] for o in arm.children if o.type == 'MESH' for c in o.bound_box)
    root.scale = (DEZ_H/hz0,)*3
    acts = {a.name.split('_')[0]: a for a in bpy.data.actions if a not in bacts}; E['act'] = acts['idle']
    arm.animation_data_create(); arm.animation_data.action = acts['idle']
    bpy.context.view_layer.update()
    lm = mat('dz_lany', P['coral'], rough=0.6); cm = mat('dz_card', P['paper'], rough=0.5)
    hz = hz0
    body = [o for o in arm.children if o.type == 'MESH']
    card = cube(root, cm, (0.0, -0.17, hz*0.42), (0.06, 0.01, 0.08), index=index); lan = cube(root, lm, (0.0, -0.165, hz*0.5), (0.015, 0.008, 0.14), index=index)
    for o in (card, lan): o.scale = Vector(o.scale)/root.scale[0]; o.location = Vector(o.location)/root.scale[0]
    all_index(E); pose(E, 'idle', 0); return E
def pose_dez(E, anim, k):
    n = NF(E, anim); fr = E['act'].frame_range; bpy.context.scene.frame_set(int(fr[0] + (fr[1] - fr[0])*k/n))

BUILD.update(moths=build_moths, the49=build_the49, star49=lambda: build_star49(), star49x=lambda: build_star49(cracked=True), never=build_never, dez=build_dez)
POSE.update(moths=pose_moths, the49=pose_the49, star49=pose_star49, star49x=pose_star49, never=pose_never, dez=pose_dez)

# ======================= P3: hand-tuned move cycles (carried over from v5) =======================
# 8 frames instead of 6, and a per-enemy time warp so each step lingers on its contact pose and snaps through the passing pose
# (heavy enemies linger longer). The pose code itself is phase-driven, so a fractional k is safe for 'move'.
MOVE_WARP = {'warden': 0.55, 'redactor': 0.40, 'sycophant': 0.30, 'hallucinator': 0.20, 'autocomplete': 0.15}
_pose_base = pose
def pose(E, anim, k):
    if anim == 'move' and E['name'] in MOVE_WARP:
        n = NF(E, 'move'); u = k/n; a = MOVE_WARP[E['name']]
        w = u - a*math.sin(4*math.pi*u)/(4*math.pi)        # two steps per cycle: slow near contacts (u = 0, .5), fast through passing
        reset(E); POSE[E['name']](E, anim, w*n); bpy.context.view_layer.update(); return
    _pose_base(E, anim, k)
