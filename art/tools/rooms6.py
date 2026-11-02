TINT = False
# art-v6 rooms (exec'd by scene6.py; uses its helpers). One function per room id; ROOMS6 maps MODE -> builder.
# Calm rules: one warm + one cool light family, <= 1 accent, props in edge clusters, <= 2 word-tile phrases.
_GRADE = {}
def cprop(name, x, y, rz=0, s=1.0, z=0.0, index=0, parent=None, val=None, sat=None):
    """centred Kenney prop (footprint centred on x,y) registered for the calm prop grade; val/sat = per-prop grade override"""
    e = kprop(name, parent, (x, y, z), rz=rz, s=s, index=index)
    for nm in e['meshes']:
        for sl in bpy.data.objects[nm].material_slots:
            if not sl.material: continue
            if val is not None or sat is not None:
                key = (sl.material.name, val, sat)
                if key not in _GRADE:
                    m2 = sl.material.copy(); m2['tuned'] = 0
                    if val is not None: m2['val'] = val
                    if sat is not None: m2['sat'] = sat
                    _GRADE[key] = m2
                sl.link = 'OBJECT'; sl.material = _GRADE[key]
            PROP_MATS.add(sl.material)
    return e

def screen_on(mon, tex, emit=0.7):
    inner = mon.children[0]
    p = plane('screen', 0.32, 0.19, img_mat('scr_'+os.path.basename(tex), tex, emit=emit, rough=0.2), (0, 0, 0), rot=(R(90), 0, 0)); p.parent = inner; p.location = (0.195, 0.035, 0.17)
    return p

def desk_station(x, y, rz, on=False, nameplate=True, s=0.9, chair_out=0.0):
    """one support desk: desk + monitor (off unless on) + chair pushed in on the room side + face-down nameplate"""
    root = bpy.data.objects.new('station', None); sc.collection.objects.link(root); root.location = (x, y, 0); root.rotation_euler = (0, 0, R(rz))
    d = cprop('desk', 0, 0, 0, s=s, parent=root, val=0.42); dw, dd, dh = d['size']; TINT and tint_prop(d, (214, 222, 232))
    m = cprop('computerScreen', 0, dd*0.18, 0, s=s, z=dh, parent=root)
    if on: screen_on(m, globals().get('MON_TEX') or TX+'monC_chat.png', globals().get('MON_EMIT', 0.8))
    else: screen_on(m, TX+'monC_chat.png', 0.0).data.materials[0] = srgb('scroff', (10, 14, 20), rough=0.25)
    ch = cprop('chairDesk', 0.0, -dd*0.55 - chair_out, 180, s=s*0.95, parent=root, val=0.55, sat=0.3); TINT and tint_prop(ch, (180, 192, 220))
    if nameplate:
        box('nameplate', (0.14, 0.05, 0.012), (0, 0, 0), srgb('nplate', (40, 46, 58), rough=0.5)).parent = root
        bpy.data.objects[bpy.context.object.name].location = (dw*0.30, -dd*0.30, dh + 0.008)
    return root, (dw, dd, dh)

# ================= R8 THE LAST ROW (floor 2 elite, vertical slice) =================
def R8():
    global CAM_T; CAM_T = (0.3, 1.68)
    shell(wall=(36, 56, 72), trim=(24, 38, 48)); door(-0.2, accent=(90, 170, 190)); world()
    bpy.data.objects.remove(bpy.data.objects['exitsign'], do_unlink=True)   # the neon replaces the exit sign
    # signature: small, dim cyan neon ALWAYS BE HELPFUL above the lift
    ni = bpy.data.images.load(TX6+'neon_helpful.png'); nw = 0.16*ni.size[0]/ni.size[1]
    plane('neon', nw, 0.16, img_mat('neon', TX6+'neon_helpful.png', emit=1.0), (-0.2, 3.97, 1.43), rot=(R(90), 0, 0), index=IDX['env'])
    # hook: twelve desks in a horseshoe (left wall 4, back wall 2+2 either side of the lift, right edge 4). Chairs pushed in.
    for yy in (0.45, 1.25, 2.05, 2.85): desk_station(-3.62, yy, 90)
    for xx in (-2.75, -1.75): desk_station(xx, 3.58, 0)
    for xx in (1.45, 2.45): desk_station(xx, 3.58, 0, on=(xx == 1.45))
    for yy in (0.95, 1.65, 2.35, 3.05): desk_station(3.72, yy, -90, s=0.82)
    # Noor's desk (back row, right of the lift): lamp still on, monitor on, sticky note
    cprop('lampSquareTable', 1.12, 3.68, 0, s=0.9, z=0.34); lamp_glow(1.12, 3.58, 0.52, 10)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.055, location=(1.12, 3.68, 0.60)); bpy.context.object.data.materials.append(emit_mat('bulb', (255, 206, 150), 5.0)); bpy.context.object.scale = (1.0, 1.0, 1.3)
    sn = plane('sticky', 0.07, 0.07, img_mat('sticky', TX6+'sticky_49.png', emit=0.25), (1.62, 3.52, 0.62), rot=(R(90), 0, R(-8)))
    light('SPOT', (1.3, 3.0, 2.2), 260, (1.0, 0.72, 0.46), 0.4, spot=50, blend=0.9)
    prop('pottedPlant', -3.95, 3.55, 0); prop('plantSmall2', 3.9, 3.5, 0, s=1.5)
    prop('pottedPlant', -3.6, -1.85, 0, s=1.8)          # dark foreground framing
    base_lights(amb=(0.28, 0.44, 0.60), amb_e=66)
    light('SPOT', (0.0, 1.0, 3.4), 1150, (1.0, 0.72, 0.46), 0.6, spot=46, blend=0.75)    # soft warm arena pool
    light('SPOT', (-2.6, 1.6, 3.0), 140, (0.50, 0.78, 0.90), 0.6, spot=70, blend=1.0)     # cool teal wash on the left desks
    light('SPOT', (3.0, 1.9, 3.0), 110, (0.50, 0.78, 0.90), 0.6, spot=65, blend=1.0)      # ...and the right desks
    light('SPOT', (-2.2, 3.0, 2.6), 60, (0.50, 0.78, 0.90), 0.5, spot=60, blend=1.0)     # ...and the back-left pair
    rule_tiles(['DOOR', 'IS', 'SHUT'], -1.55, 2.6, h=0.22)
    place_noor(-0.45, 0.55, 'E', 'idle', 10)
    place_enemy('caret', -1.2, 0.1, 'S', 'idle', 0)
    place_enemy('warden', 1.2, 0.95, 'SW', 'idle', 0)
    place_enemy('sycophant', 2.5, 0.35, 'SW', 'idle', 0)
    rule_tiles(['WARDEN', 'REFUSES', 'NOOR'], 1.2, 0.95, h=0.15, z=1.52, floating=True, emit=0.9)


def place_free(name, x, y, rz, anim='idle', k=0, z=0.0, log_dir='S'):
    """enemy/part at an exact heading (chain parts, cones): rz = degrees, 0 = faces camera-south"""
    E = BUILD[name](); ACTOR_LOG.append(dict(name=name.split('_')[0] if name.startswith('thread') else name, x=x, y=y, dir=log_dir))
    E['root'].location = (x, y, z); E['root'].rotation_euler = (0, 0, R(SCR_RZ + rz)); pose(E, anim, k); add_actor_objs(E['root']); return E

def floor_decal(name, tex, x, y, w, h, rz=0, emit=0.6, z=0.004, alpha=True, index=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    for n_ in list(nt.nodes):
        if n_.type != 'OUTPUT_MATERIAL': nt.nodes.remove(n_)
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(tex, check_existing=True)
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs[1].default_value = emit; nt.links.new(t.outputs['Color'], em.inputs[0])
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(t.outputs['Alpha'], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], nt.nodes['Material Output'].inputs[0]); m.blend_method = 'BLEND'
    o = plane(name, w, h, m, (x, y, z), rot=(0, 0, R(rz)), index=IDX['env'] if index is None else index)
    o.visible_shadow = False; return o

def paper_person(x, y, rz=0, z=0.0, seated=True, cardigan=False, s=1.0):
    """folded-paper claimant (faceted origami figure), not a ghost"""
    pm = srgb('paperfig', (214, 208, 192), rough=0.85); root = bpy.data.objects.new('claimant', None); sc.collection.objects.link(root)
    root.location = (x, y, z); root.rotation_euler = (0, 0, R(rz)); root.scale = (s, s, s)
    bz = 0.42 if seated else 0.0
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.14, radius2=0.05, depth=0.34, location=(0, 0, bz + 0.17)); b = bpy.context.object; b.parent = root; b.data.materials.append(srgb('cardi', (150, 104, 60), rough=0.9) if cardigan else pm); b.rotation_euler = (0, 0, R(45))
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.085, location=(0, 0, bz + 0.42)); h = bpy.context.object; h.parent = root; h.data.materials.append(pm)
    if seated:
        for sx in (-1, 1):
            bpy.ops.mesh.primitive_cube_add(size=1, location=(sx*0.05, -0.12, bz + 0.02)); l = bpy.context.object; l.scale = (0.05, 0.22, 0.04); l.parent = root; l.data.materials.append(pm)
    return root

def thread_coil(cx, cy, rx, ry, n=10, start=200, span=300, anim='move', head_rz=None):
    """the Thread coiled on an ellipse: head at the start angle, segments trail along the curve, tail last"""
    pts = []
    for i in range(n + 2):
        a = math.radians(start - span*i/(n + 1)); pts.append((cx + rx*math.cos(a), cy + ry*math.sin(a)))
    for i, (x, y) in enumerate(pts):
        nx_, ny_ = pts[i-1] if i > 0 else (2*pts[0][0] - pts[1][0], 2*pts[0][1] - pts[1][1])
        hd = math.degrees(math.atan2(nx_ - x, -(ny_ - y)))   # heading towards the previous point (the chain moves head-first)
        nm = 'thread_head' if i == 0 else ('thread_tail' if i == len(pts) - 1 else 'thread_seg')
        place_free(nm, x, y, hd - SCR_RZ, anim, (i*2) % 6)
    return pts

def glow_box(name, dims, loc, rgb, strength, index=None):
    return box(name, dims, loc, emit_mat(name, rgb, strength), index=IDX['env'] if index is None else index)

# ================= R1 INTAKE (tutorial: chute, falling tickets, sorting pad) =================
def R1():
    shell(wall=(34, 54, 68), trim=(22, 36, 46)); door(2.3, accent=(110, 200, 220)); world()
    # signature: pneumatic intake chute in the NW ceiling + one warm light shaft + slow paper snow into a sorting tray
    CX, CY = -2.5, 2.25; tm = srgb('chute', (60, 72, 90), rough=0.35, metal=0.6)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.24, depth=1.2, location=(CX, CY, 2.35)); c = bpy.context.object; c.data.materials.append(tm); c.pass_index = IDX['env']
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.36, radius2=0.24, depth=0.18, location=(CX, CY, 1.70), end_fill_type='NOTHING'); f = bpy.context.object; f.data.materials.append(tm); f.modifiers.new('s', 'SOLIDIFY').thickness = 0.02
    bpy.ops.mesh.primitive_circle_add(vertices=24, radius=0.34, fill_type='NGON', location=(CX, CY, 1.62)); bpy.context.object.data.materials.append(emit_mat('chutemouth', (255, 214, 160), 2.2))
    light('SPOT', (CX, CY, 1.58), 260, (1.0, 0.76, 0.50), 0.25, rot=(0, 0, 0), spot=34, blend=0.6)
    shaft = bpy.data.materials.new('shaft'); shaft.use_nodes = True; nt = shaft.node_tree
    for n_ in list(nt.nodes):
        if n_.type != 'OUTPUT_MATERIAL': nt.nodes.remove(n_)
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = (1.0, 0.78, 0.52, 1); em.inputs[1].default_value = 0.35
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader'); mx.inputs[0].default_value = 0.06
    nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], nt.nodes['Material Output'].inputs[0]); shaft.blend_method = 'BLEND'
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.62, radius2=0.30, depth=1.58, location=(CX, CY, 0.80), end_fill_type='NOTHING'); sh = bpy.context.object; sh.data.materials.append(shaft); sh.visible_shadow = False; sh.pass_index = IDX['env']
    box('tray', (0.9, 0.6, 0.12), (CX, CY, 0.06), srgb('tray', (70, 78, 96), rough=0.5), bevel=0.02)
    pp = srgb('ticketpaper', (226, 220, 204), rough=0.8); rnd = random.Random(11)
    for i in range(11):
        z = 0.2 + i*0.13; x = CX + rnd.uniform(-0.28, 0.28); y = CY + rnd.uniform(-0.2, 0.2)
        plane('tk', 0.12, 0.16, pp, (x, y, z), rot=(R(rnd.uniform(20, 70)), R(rnd.uniform(-30, 30)), R(rnd.uniform(0, 180))))
    for i in range(5): plane('tkp', 0.12, 0.16, pp, (CX + rnd.uniform(-0.35, 0.35), CY + rnd.uniform(-0.22, 0.22), 0.125), rot=(0, 0, R(rnd.uniform(0, 180))))
    # round sorting pad in the south where Noor lands (soft ice ring = the Caret's accent)
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.62, depth=0.03, location=(-0.4, 0.45, 0.015)); pd = bpy.context.object; pd.data.materials.append(srgb('pad', (50, 66, 80), rough=0.4, metal=0.3)); pd.pass_index = IDX['env']
    bpy.ops.mesh.primitive_torus_add(major_radius=0.58, minor_radius=0.008, major_segments=64, minor_segments=6, location=(-0.4, 0.45, 0.032)); pr = bpy.context.object; pr.scale.z = 0.3; pr.data.materials.append(emit_mat('padring', (170, 226, 236), 1.0)); pr.pass_index = IDX['env']
    # right-edge cluster: filing cabinets + a lamp; back-right: a coat rack and plant by the door
    for yy in (1.1, 1.55): prop('kitchenCabinetDrawer', 3.98, yy, 90)
    prop('lampRoundFloor', 3.9, 2.1, 0); lamp_glow(3.95, 2.15, 0.95, 12)
    prop('coatRackStanding', 3.2, 3.7, 0); prop('pottedPlant', 1.45, 3.75, 0)
    prop('pottedPlant', -3.6, -1.85, 0, s=1.8)
    base_lights(amb=(0.28, 0.44, 0.60), amb_e=66)
    light('SPOT', (0.2, 1.0, 3.4), 900, (1.0, 0.72, 0.46), 0.6, spot=46, blend=0.8)
    light('SPOT', (2.6, 2.4, 2.8), 70, (0.5, 0.78, 0.9), 0.4, spot=55, blend=1.0)
    rule_tiles(['CHUTE', 'IS', 'OPEN'], -1.95, 1.55, h=0.2)
    rule_tiles(['DOOR', 'IS', 'SHUT'], 1.75, 2.85, h=0.2)
    place_noor(-0.4, 0.45, 'NE', 'idle', 10)
    place_enemy('caret', -1.05, 0.2, 'S', 'assist', 4)
    place_enemy('autocomplete', 1.35, 1.0, 'S', 'idle', 2)

# ================= R2 THE STACKS (adapts H5 archive: aisle, three brass lamps, Recycle Bin) =================
def recycle_bin(x, y, s=1.0):
    wm = srgb('wire', (130, 150, 160), rough=0.3, metal=0.8)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.22*s, depth=0.42*s, location=(x, y, 0.21*s), end_fill_type='NOTHING'); b = bpy.context.object
    b.data.materials.append(wm); w = b.modifiers.new('w', 'WIREFRAME'); w.thickness = 0.008; b.pass_index = 0
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.21*s, depth=0.01, location=(x, y, 0.01)); bpy.context.object.data.materials.append(wm)
    gm = emit_mat('binpaper', (120, 220, 232), 1.4); rnd = random.Random(5)
    for i in range(6):
        bpy.ops.mesh.primitive_plane_add(size=0.12*s, location=(x + rnd.uniform(-0.1, 0.1), y + rnd.uniform(-0.1, 0.1), 0.06*s + i*0.05*s), rotation=(R(rnd.uniform(0, 60)), R(rnd.uniform(0, 60)), R(rnd.uniform(0, 180))))
        bpy.context.object.data.materials.append(gm)
    light('POINT', (x, y, 0.35*s), 6, (0.45, 0.85, 0.92), 0.15)

def R2():
    shell(wall=(36, 54, 74), trim=(24, 36, 50)); door(-0.2, accent=(110, 200, 220)); world()
    for xx in (-3.65, -2.8, -1.95, -1.1, 0.65, 1.5, 2.35, 3.2):        # back ticket shelf run (one continuous calm rhythm)
        prop('bookcaseClosedWide', xx, 3.72, 0); prop('bookcaseClosedWide', xx, 3.72, 0, z=0.79); books_row(xx, 3.72, (0.03, 0.40, 0.82, 1.19))
    for yy in (1.2, 2.05):                                                              # left shelf end (the aisle's west wall)
        e = bpy.data.objects.new('aisle', None); sc.collection.objects.link(e); e.location = (-3.62, yy, 0); e.rotation_euler = (0, 0, R(90))
        prop('bookcaseClosedWide', -0.42, -0.2, 0, parent=e); prop('bookcaseClosedWide', -0.42, -0.2, 0, z=0.79, parent=e); books_row(-0.42, -0.2, (0.03, 0.40, 0.82, 1.19), parent=e)
    # three brass reading lamps on chains = three warm pools along the aisle (west -> east)
    for x_, e_ in ((-2.2, 520), (0.2, 560), (2.5, 520)):
        pendant(x_, 1.55, 2.05, energy=0); light('SPOT', (x_, 1.55, 2.6), e_, (1.0, 0.72, 0.46), 0.4, spot=42, blend=0.7)
    recycle_bin(3.55, 0.55)                                                             # signature: the Recycle Bin (only cyan in the room)
    prop('desk', 3.62, 2.2, 90); prop('chairDesk', 3.25, 2.35, -90)
    prop('pottedPlant', 3.75, -1.8, 0, s=1.8)
    base_lights(amb=(0.24, 0.38, 0.60), amb_e=60)
    build_fern(1.25, 3.05, 1.7, rz=SCR_RZ)                                              # silent cameo at the back
    rule_tiles(['NOTHING', 'IS', 'DELETED'], -0.85, 2.7, h=0.29)
    place_noor(-0.75, 0.55, 'SE', 'idle', 10)
    place_enemy('caret', -1.4, 0.15, 'S', 'idle', 2)
    place_enemy('autocomplete', -2.4, 1.15, 'S', 'idle', 0)
    place_enemy('autocomplete', 0.9, 1.75, 'S', 'move', 3)
    place_enemy('redactor', 1.85, 0.55, 'W', 'idle', 0)

# ================= R5 HOT DESKS (context edge, truth-light rule on a fake door) =================
def R5():
    shell(wall=(36, 56, 72), trim=(24, 38, 48)); world()
    # signature: the context edge, a band of unloaded floor dissolving into ice motes (diagonal across the back-right)
    floor_decal('edge', TX6+'context_edge.png', 1.55, 2.25, 1.15, 4.4, rz=-28, emit=0.6)
    rnd = random.Random(3); mm = emit_mat('mote', (200, 236, 246), 1.2)
    for i in range(26):
        t = rnd.random(); x = 1.55 + (t-0.5)*4.4*math.sin(R(28)) + rnd.uniform(-0.6, 0.6)*math.cos(R(28)); y = 2.25 + (t-0.5)*4.4*math.cos(R(28)) + rnd.uniform(-0.3, 0.3)
        bpy.ops.mesh.primitive_cube_add(size=0.025, location=(x, y, rnd.uniform(0.05, 0.9))); o = bpy.context.object; o.data.materials.append(mm); o.visible_shadow = False; o.pass_index = IDX['env']
    # hook: rows of identical hot desks, each with a small warm desk lamp (near side, left)
    for (x, y, rz) in ((-3.62, 0.6, 90), (-3.62, 1.45, 90), (-3.62, 2.3, 90), (-2.5, 3.58, 0), (-1.5, 3.58, 0)):
        st, (dw, dd, dh) = desk_station(x, y, rz, on=False, nameplate=False)
        lmp = cprop('lampSquareTable', -dw*0.34, dd*0.12, 0, s=0.75, z=dh, parent=st)
        wx = st.matrix_world @ Vector((-dw*0.34, dd*0.12, dh + 0.25)); lamp_glow(wx.x, wx.y, wx.z, 6)
    # the island beyond the gap: two desks and the Draft in a lamp pool
    for (x, y, rz) in ((3.05, 3.45, 0), (3.72, 2.25, -90)): desk_station(x, y, rz, on=False, nameplate=False)
    light('SPOT', (3.0, 2.7, 2.6), 300, (1.0, 0.72, 0.46), 0.4, spot=40, blend=0.8)
    place_enemy('draft', 2.95, 2.55, 'S', 'idle', 2)
    # the truth-light lesson: a fake exit door (lavender rim, no contact shadow) next to the real one
    door(-0.4, accent=(110, 200, 220))
    fd = plane('fakedoor', 0.62, 0.92, img_mat('fakedoor', TX5+'fakedoor.png', emit=0.9), (-2.2, 2.65, 0.47), rot=(R(90), 0, R(SCR_RZ)), index=IDX['env']); fd.visible_shadow = False
    light('AREA', (-2.2, 2.45, 0.6), 4, (0.6, 0.5, 0.9), 0.6, rot=(R(90), 0, R(SCR_RZ + 180)))
    prop('pottedPlant', -3.6, -1.85, 0, s=1.8)
    base_lights(amb=(0.28, 0.44, 0.60), amb_e=64)
    light('SPOT', (-0.6, 0.9, 3.4), 900, (1.0, 0.72, 0.46), 0.6, spot=44, blend=0.8)
    rule_tiles(['DOOR', 'IS', 'REAL'], -0.4, 3.0, h=0.2)
    rule_tiles(['FAKE', 'IS', 'FAKE'], 0.95, 0.75, h=0.2, rz=SCR_RZ - 28)
    place_noor(-0.95, 0.5, 'NE', 'idle', 10)
    place_enemy('caret', -1.55, 0.2, 'S', 'idle', 0)
    place_enemy('hallucinator', 0.4, 1.4, 'S', 'idle', 0)
    place_enemy('hallucinator', 2.6, -0.3, 'S', 'idle', 3)
    place_enemy('autocomplete', -2.15, 1.55, 'S', 'move', 1)

# ================= R6 SEEN (stealth: partitions, two reading cones, the 03:12 clock) =================
def partition(x, y, length, rz, h=0.62):
    pm = srgb('partfab', (46, 62, 80), rough=0.95); fr = srgb('partframe', (26, 34, 44), rough=0.5)
    e = bpy.data.objects.new('partition', None); sc.collection.objects.link(e); e.location = (x, y, 0); e.rotation_euler = (0, 0, R(rz))
    b = box('part', (length, 0.05, h), (0, 0, h/2), pm); b.parent = e; t = box('parttop', (length + 0.02, 0.07, 0.025), (0, 0, h), fr); t.parent = e
    return e

def R6():
    shell(wall=(30, 46, 64), trim=(20, 32, 44)); door(2.6, accent=(110, 200, 220)); world()
    # L-shaped pod area: partitions along the walls make shadow lanes
    partition(-2.9, 1.0, 1.6, 90); partition(-2.1, 3.1, 1.4, 0); partition(-3.3, 3.1, 0.9, 0)
    partition(1.0, 3.15, 1.4, 0); partition(3.65, 2.55, 0.9, 90)
    for (x, y, rz) in ((-3.62, 0.55, 90), (-3.62, 1.55, 90), (-1.95, 3.6, 0), (1.0, 3.6, 0)): desk_station(x, y, rz, on=False)
    # the phone face down on a desk, glowing round the edges; the wall clock at 03:12 (never moves)
    box('phone', (0.07, 0.13, 0.012), (-1.75, 3.45, 0.355), srgb('phone', (16, 18, 24), rough=0.3))
    bpy.ops.mesh.primitive_plane_add(size=1, location=(-1.75, 3.45, 0.349)); ph = bpy.context.object; ph.scale = (0.10, 0.16, 1); ph.data.materials.append(emit_mat('phoneglow', (150, 226, 240), 2.0))
    plane('clock', 0.34, 0.34, img_mat('clock', TX6+'clock_0312.png', emit=0.35), (-0.3, 3.985, 1.18), rot=(R(90), 0, 0), index=IDX['env'])
    # signature: two reading cones sweeping the carpet (ice, low alpha); the receipts stand at their apex
    floor_decal('cone1', TX6+'read_cone.png', -1.0, 0.9, 2.6, 2.6, rz=-35 + 180, emit=0.62)
    floor_decal('cone2', TX6+'read_cone.png', 1.45, 2.0, 2.6, 2.6, rz=120 + 180, emit=0.62)
    place_enemy('receipt', -1.0 + 0.0, 0.9 - 0.0, 'S', 'idle', 1)
    place_enemy('receipt', 1.45, 2.0, 'S', 'idle', 4)
    place_enemy('hound', 3.05, 1.25, 'W', 'idle', 0)            # asleep until Noor is seen
    place_enemy('draft', 0.25, 1.35, 'S', 'idle', 5)          # where the cones cross
    # warm lamp at the exit (the one warm pool)
    prop('lampRoundFloor', 3.25, 3.6, 0); lamp_glow(3.3, 3.65, 0.95, 14); light('SPOT', (2.7, 3.1, 2.6), 260, (1.0, 0.72, 0.46), 0.4, spot=42, blend=0.8)
    prop('pottedPlant', -3.6, -1.85, 0, s=1.8)
    base_lights(amb=(0.24, 0.38, 0.58), amb_e=56)
    light('SPOT', (-0.2, 1.2, 3.4), 420, (0.62, 0.80, 0.92), 0.6, spot=50, blend=0.8)
    rule_tiles(['NOOR', 'IS', 'SEEN'], 0.9, 0.05, h=0.2)
    place_noor(-2.5, 2.35, 'SE', 'walk', 3)
    place_enemy('caret', -2.95, 2.05, 'S', 'idle', 3)

# ================= R10 THE WAITING ROOM (quiet puzzle) =================
def R10():
    shell(wall=(40, 56, 70), trim=(26, 38, 48)); world()
    # service hatch (closed) in the north wall with one warm lamp over it
    HX = 0.6; box('hatchframe', (1.1, 0.12, 0.8), (HX, 3.96, 0.95), srgb('hatchf', (30, 36, 46), rough=0.5))
    box('hatchshut', (0.92, 0.06, 0.62), (HX, 3.92, 0.95), srgb('hatch', (90, 100, 112), rough=0.4, metal=0.4))
    for k in range(6): box('slat', (0.9, 0.02, 0.012), (HX, 3.885, 0.70 + k*0.1), srgb('slat', (120, 130, 140), rough=0.4, metal=0.5))
    box('hatchsill', (1.2, 0.3, 0.05), (HX, 3.85, 0.6), srgb('sill', (70, 60, 56), rough=0.6))
    bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=0.15, radius2=0.04, depth=0.12, end_fill_type='NOTHING', location=(HX, 3.75, 1.62)); bpy.context.object.data.materials.append(srgb('shade2', (24, 30, 38), metal=0.4))
    bpy.ops.mesh.primitive_circle_add(vertices=20, radius=0.14, fill_type='NGON', location=(HX, 3.75, 1.56)); bpy.context.object.data.materials.append(emit_mat('wl', (255, 210, 150), 3.0))
    light('SPOT', (HX, 3.7, 1.55), 160, (1.0, 0.74, 0.48), 0.2, spot=70, blend=0.9)
    # signature: NOW SERVING display frozen at 0412 (soft amber), ticket dispenser
    plane('nowserving', 0.9, 0.35, img_mat('nows', TX6+'now_serving.png', emit=1.2), (-1.35, 3.985, 0.92), rot=(R(90), 0, 0), index=IDX['env'])
    box('dispost', (0.05, 0.05, 0.9), (1.75, 3.55, 0.45), srgb('post', (60, 66, 80), metal=0.5)); box('disp', (0.2, 0.14, 0.26), (1.75, 3.55, 0.98), srgb('disp', (200, 90, 90), rough=0.4))
    plane('tickout', 0.06, 0.09, img_mat('ticket', TX6+'ticket.png', emit=0.2), (1.75, 3.47, 0.92), rot=(R(80), 0, 0))
    # striped queue line on the floor leading to the hatch
    qm = srgb('queuestripe', (150, 160, 150), rough=0.6)
    for k in range(9): plane('q', 0.30, 0.06, qm, (HX - 0.1, 0.9 + k*0.3, 0.003), rot=(0, 0, R(-6)), index=IDX['env'])
    # plastic chairs along the walls, five folded-paper claimants, the fern on a chair
    seats = [(-3.75, 0.5, 90), (-3.75, 1.1, 90), (-3.75, 1.7, 90), (-3.75, 2.3, 90), (-3.75, 2.9, 90), (3.8, 0.9, -90), (3.8, 1.5, -90), (3.8, 2.1, -90), (3.8, 2.7, -90)]
    for (x, y, rz) in seats: cprop('chairModernCushion', x, y, rz, s=0.95, val=0.55, sat=0.4)
    who = {0: False, 2: True, 3: False, 5: False, 7: False}
    for i, cd in who.items():
        x, y, rz = seats[i]; paper_person(x + (0.06 if rz == 90 else -0.06), y, rz + 180 - 90 + 90, z=0.0, seated=True, cardigan=cd, s=0.95)
    x, y, rz = seats[6]; prop('plantSmall3', x - 0.15, y - 0.1, 0, z=0.42, s=1.6)
    # cyan fish tank (the cool light) on a low cabinet, back-left
    prop('sideTableDrawers', -2.85, 3.68, 0, s=1.1)
    box('tank', (0.75, 0.32, 0.42), (-2.85, 3.68, 0.70), emit_mat('tankwater', (60, 170, 190), 0.07)); box('tanklid', (0.78, 0.34, 0.03), (-2.85, 3.68, 0.92), srgb('lid', (30, 36, 44)))
    light('AREA', (-2.85, 3.3, 0.8), 4, (0.4, 0.85, 0.95), 0.8, rot=(R(80), 0, 0))
    prop('pottedPlant', 3.6, -1.85, 0, s=1.8)
    base_lights(amb=(0.28, 0.44, 0.60), amb_e=62)
    light('SPOT', (0.3, 1.2, 3.4), 760, (1.0, 0.72, 0.46), 0.6, spot=44, blend=0.8)
    rule_tiles(['QUEUE', 'IS', 'FROZEN'], -1.35, 2.75, h=0.2)
    rule_tiles(['HATCH', 'IS', 'SHUT'], 1.6, 2.55, h=0.2)
    place_noor(0.1, 0.55, 'N', 'idle', 10)
    place_enemy('caret', -0.55, 0.3, 'S', 'idle', 1)

# ================= R11 PENDING REVIEW (elite: the Thread coiled in an oval mail hall) =================
def conveyor(x0, x1, y, z=0.0, rz=0):
    L = abs(x1 - x0); cx = (x0 + x1)/2; e = bpy.data.objects.new('conv', None); sc.collection.objects.link(e); e.location = (cx, y, z); e.rotation_euler = (0, 0, R(rz))
    b = box('convbody', (L, 0.42, 0.34), (0, 0, 0.17), srgb('conv', (44, 52, 66), rough=0.5, metal=0.3)); b.parent = e
    t = plane('belt', L, 0.36, img_mat('belt', TX6+'belt.png', rough=0.6), (0, 0, 0.342)); t.parent = e
    for u in (-L/2 + 0.1, L/2 - 0.1): r_ = box('roller', (0.06, 0.44, 0.06), (u, 0, 0.32), srgb('roll', (110, 120, 132), metal=0.8)); r_.parent = e
    em = img_mat('envtex', TX6+'env_seg.png', emit=0.1, rough=0.8); k = -L/2 + 0.3
    while k < L/2 - 0.2:
        p_ = plane('env', 0.26, 0.17, em, (k, 0.0, 0.36), rot=(0, 0, R(90 + random.uniform(-15, 15)))); p_.parent = e; k += 0.45
    return e

def R11():
    shell(wall=(30, 44, 62), trim=(20, 30, 42)); door(-0.2, accent=(150, 180, 200)); world()
    # glass meeting room: tall mullions along the back wall, cool mist ceiling panels
    for xx in (-3.4, -2.4, -1.4, 1.0, 2.0, 3.0): box('mullion', (0.05, 0.06, 2.3), (xx, 3.97, 1.15), srgb('mull', (60, 76, 92), metal=0.5), index=IDX['env'])
    for xx in (-2.9, -1.9, 1.5, 2.5): box('glass', (0.9, 0.02, 1.9), (xx, 3.95, 1.25), emit_mat('glasspane', (60, 90, 110), 0.25), index=IDX['env'])
    for (x, y) in ((-1.6, 1.2), (1.6, 1.2), (-1.6, 2.8), (1.6, 2.8)): light('AREA', (x, y, 3.0), 70, (0.62, 0.78, 0.92), 1.2)
    # envelope conveyors along the walls (edge clusters, centre stays open for the coil)
    conveyor(-3.5, -1.0, 3.45); conveyor(0.7, 3.5, 3.45)
    c2 = conveyor(-1.2, 1.2, 0.0, rz=90); c2.location = (-3.72, 1.55, 0)
    # far end: one warm desk lamp over the unopened approval letter
    prop('desk', 3.62, 1.75, 90); cprop('lampSquareTable', 3.82, 1.3, 0, s=0.9, z=0.38); lamp_glow(3.82, 1.3, 0.62, 10)
    plane('letter', 0.22, 0.15, img_mat('sealed', TX6+'env_head.png', emit=0.25), (3.75, 1.75, 0.395), rot=(0, 0, R(80)))
    light('SPOT', (3.6, 1.6, 2.4), 240, (1.0, 0.72, 0.46), 0.3, spot=40, blend=0.8)
    prop('pottedPlant', 3.7, -1.8, 0, s=1.8)
    base_lights(amb=(0.26, 0.40, 0.58), amb_e=60)
    # the Thread coiled round the open centre (head at the front-left, tail = Papa's first email)
    thread_coil(0.3, 1.55, 1.85, 1.15, n=7, start=205, span=250)
    rule_tiles(['THREAD', 'IS', 'PENDING'], 0.4, 1.7, h=0.17)
    place_noor(-0.55, 1.0, 'E', 'idle', 10)
    place_enemy('caret', -1.0, 0.75, 'S', 'idle', 2)
    EXTRA_LOG['review_plate'] = [0.4, 1.7, 0.05]

ROOMS6 = dict(R8=R8, R1=R1, R2=R2, R5=R5, R6=R6, R10=R10, R11=R11)
exec(open(T5+'rooms6_p2.py').read())
exec(open(T5+'rooms6_p3.py').read())
