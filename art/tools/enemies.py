# art-v5 enemy + ally builds and their procedural animation (no rigs: every part is posed per frame from its rest
# transform). Used by enemy_sprites.py (sprite sheets) and scene5.py (room mocks), so sheets and mocks match.
# Original modelling on top of Kenney Furniture Kit (CC0) props; fonts/textures are generated (make_tex_v5.py).
# Calm palette: deep teal / indigo bodies, one role colour each, emission kept low (bloom is gentle in v5).
#   build_<name>() -> E (dict); pose(E, anim, k) sets frame k of anim. Every root faces -Y (= towards camera at S).
import bpy, math, random, mathutils
from mathutils import Vector, Euler, Quaternion, Matrix
_r = math.radians
EV5 = '/workspace/games/prompt-injection/art-v5/'
FKD = '/workspace/games/_downloads/furniture-kit/Models/GLTF format/'

def _s2l(c):
    c = c/255.0; return c/12.92 if c <= 0.04045 else ((c+0.055)/1.055)**2.4
def L3(rgb): return tuple(_s2l(v) for v in rgb)

# ---- calm palette (sRGB) ----
P = dict(ink=(8, 10, 22), navy=(16, 24, 44), deepteal=(16, 52, 64), teal=(36, 108, 122), indigo=(38, 40, 86), slate=(74, 84, 116),
         mist=(156, 174, 198), warm=(255, 198, 132), amber=(230, 160, 84), magenta=(226, 86, 168), pink=(250, 150, 212),
         cyan=(110, 220, 232), coral=(232, 96, 106), paper=(232, 228, 218), lav=(150, 128, 226), mint=(116, 222, 196), ice=(214, 240, 246))

def mat(name, rgb, rough=0.5, metal=0.0, emit=0.0, emit_rgb=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*L3(rgb), 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    b.inputs['Emission Color'].default_value = (*L3(emit_rgb or rgb), 1); b.inputs['Emission Strength'].default_value = emit
    m['base_emit'] = emit
    return m

def tex_mat(name, path, emit=0.0, rough=0.4, interp='Linear'):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(path, check_existing=True); t.interpolation = interp
    nt.links.new(t.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = rough
    if emit: nt.links.new(t.outputs['Color'], b.inputs['Emission Color'])
    b.inputs['Emission Strength'].default_value = emit; m['base_emit'] = emit; m['tex'] = t.name
    return m

def set_emit(m, v):
    m.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = v

def set_tex(m, path):
    t = m.node_tree.nodes[m['tex']]; t.image = bpy.data.images.load(path, check_existing=True)

def glow_mat(name, rgb, strength=1.5, alpha=1.0):
    """unlit emissive with a 'fade' value (alpha) for rings / bars / pulses"""
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL': nt.nodes.remove(n)
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = (*L3(rgb), 1); em.inputs[1].default_value = strength
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
    v = nt.nodes.new('ShaderNodeValue'); v.name = 'fade'; v.outputs[0].default_value = alpha
    nt.links.new(v.outputs[0], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], nt.nodes['Material Output'].inputs[0]); m.blend_method = 'BLEND'
    m['glow'] = 1; return m

def set_fade(m, v): m.node_tree.nodes['fade'].outputs[0].default_value = max(0.0, min(1.0, v))

_CACHE = {}
def kprop(name, parent, loc=(0, 0, 0), rz=0.0, s=1.0, index=0, center=True):
    """instance a Kenney Furniture Kit prop under `parent`; center=True recentres its footprint on loc."""
    if name not in _CACHE:
        before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=FKD+name+'.glb')
        new = [o for o in bpy.data.objects if o not in before]; col = bpy.data.collections.new('src_'+name)
        for o in new:
            for c in list(o.users_collection): c.objects.unlink(o)
            col.objects.link(o)
        bpy.context.view_layer.update()
        pts = []
        for o in new:
            if o.type == 'MESH': pts += [o.matrix_world @ v.co for v in o.data.vertices]
        mn = Vector([min(p[i] for p in pts) for i in range(3)]); mx = Vector([max(p[i] for p in pts) for i in range(3)])
        _CACHE[name] = (col, mn, mx)
    col, mn, mx = _CACHE[name]
    e = bpy.data.objects.new('k_'+name, None); bpy.context.scene.collection.objects.link(e); e.parent = parent
    inner = bpy.data.objects.new('ki_'+name, None); bpy.context.scene.collection.objects.link(inner); inner.parent = e
    if center: inner.location = (-(mn.x+mx.x)/2, -(mn.y+mx.y)/2, -mn.z)
    m = {}
    for o in col.objects:
        c = o.copy(); m[o] = c; bpy.context.scene.collection.objects.link(c); c.pass_index = index
    for o, c in m.items():
        c.parent = m[o.parent] if o.parent in m else inner
        if o.parent not in m: c.matrix_parent_inverse = Matrix.Identity(4)
    e.location = loc; e.rotation_euler = (0, 0, _r(rz)); e.scale = (s, s, s)
    e['size'] = tuple((mx-mn)*s); e['meshes'] = [c.name for c in m.values() if c.type == 'MESH']
    return e

def tint_prop(e, rgb, amt=1.0):
    """multiply a kprop's materials by an sRGB tint (copies the materials)"""
    done = {}
    for nm in e['meshes']:
        o = bpy.data.objects[nm]
        for sl in o.material_slots:
            m = sl.material
            if not m: continue
            if m.name not in done:
                m2 = m.copy(); nt = m2.node_tree; b = nt.nodes.get('Principled BSDF')
                if b:
                    inp = b.inputs['Base Color']
                    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs[0].default_value = amt
                    mx.inputs[7].default_value = (*L3(rgb), 1)
                    if inp.links: nt.links.new(inp.links[0].from_socket, mx.inputs[6])
                    else: mx.inputs[6].default_value = inp.default_value
                    nt.links.new(mx.outputs[2], inp)
                done[m.name] = m2
            sl.material = done[m.name]

def prim(kind, parent, mat_, loc=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0), index=0, smooth=False, **kw):
    getattr(bpy.ops.mesh, 'primitive_'+kind+'_add')(**kw)
    o = bpy.context.object; o.data.materials.append(mat_); o.parent = parent; o.location = loc; o.scale = scale
    o.rotation_euler = [_r(a) for a in rot]; o.pass_index = index
    if smooth: bpy.ops.object.shade_smooth()
    return o

def bev(o, w=0.02, seg=2):
    md = o.modifiers.new('bv', 'BEVEL'); md.width = w; md.segments = seg; md.limit_method = 'ANGLE'; return o

def cube(parent, mat_, loc, dims, rot=(0, 0, 0), index=0, bevel=0.0):
    o = prim('cube', parent, mat_, loc, dims, rot, index, size=1)
    if bevel:
        # bevel needs applied scale for even widths: bake it into the mesh
        o.data.transform(Matrix.Diagonal((*dims, 1))); o.scale = (1, 1, 1); bev(o, bevel)
    return o

def plane_tex(parent, m, loc, w, h, rot=(90, 0, 0), index=0):
    o = prim('plane', parent, m, loc, (w, h, 1), rot, index, size=1); return o

def empty(name, parent=None, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(e); e.parent = parent; e.location = loc; return e

def _new(name, index):
    root = empty(name+'_root'); E = dict(name=name, root=root, parts={}, rest={}, mats={}, index=index, extra={})
    return E

def reg(E, key, o):
    E['parts'][key] = o; E['rest'][key] = (o.location.copy(), o.rotation_euler.copy(), o.scale.copy()); return o

def show(o, v=True):
    for c in [o] + list(o.children_recursive): c.hide_render = not v

def reset(E):
    for k, o in E['parts'].items():
        l, r, s = E['rest'][k]; o.location = l.copy(); o.rotation_euler = r.copy(); o.scale = s.copy(); show(o, True)
    for k, m in E['mats'].items():
        if m.get('glow'): set_fade(m, 1.0)
        elif 'base_emit' in m: set_emit(m, m['base_emit'])

def off(E, key, d=(0, 0, 0), r=(0, 0, 0), s=None):
    o = E['parts'][key]; l0, r0, s0 = E['rest'][key]
    o.location = l0 + Vector(d); o.rotation_euler = Euler((r0.x + _r(r[0]), r0.y + _r(r[1]), r0.z + _r(r[2])))
    if s is not None:
        s = (s, s, s) if isinstance(s, (int, float)) else s
        o.scale = Vector((s0.x*s[0], s0.y*s[1], s0.z*s[2]))

def tau(k, n): return 2*math.pi*k/n

def all_index(E):
    for o in E['root'].children_recursive:
        if o.type in ('MESH', 'CURVE'): o.pass_index = E['index']

# ======================= ANIMATION TABLE =======================
# frames, fps per anim. Directions: see DIRS_FOR.
exec(open('/workspace/games/prompt-injection/art-v6/tools/anim_table.py').read())

# ======================= 1. AUTOCOMPLETE (swarm of six keycaps spelling ASSUME) =======================
def build_autocomplete(index=4, cam_q=None):
    E = _new('autocomplete', index); root = E['root']
    body = mat('ac_body', P['indigo'], rough=0.35); E['mats']['body'] = body
    rim = glow_mat('ac_rim', P['magenta'], 1.2); E['mats']['rim'] = rim
    E['extra']['cam_q'] = cam_q or Euler((_r(52), 0, 0)).to_quaternion()
    tops = {}
    for i, ch in enumerate('ASSUME'):
        k = empty('key%d' % i, root)
        cube(k, body, (0, 0, 0), (0.20, 0.20, 0.10), index=index, bevel=0.025)
        tm = tops.get(ch) or tex_mat('ac_'+ch, EV5+'tex/v3/keyH_'+ch+'.png', emit=1.1)
        tops[ch] = tm; E['mats']['top'+ch] = tm
        t = plane_tex(k, tm, (0, 0, 0.051), 0.172, 0.172, rot=(0, 0, 0), index=index)
        g = cube(k, rim, (0, 0, -0.054), (0.21, 0.21, 0.010), index=index)
        k.rotation_mode = 'QUATERNION'
        reg(E, 'key%d' % i, k)
    pose(E, 'idle', 0); return E

def _ac_home(i, ph):
    a = tau(i, 6) + ph; r = 0.30 + 0.04*math.sin(2*a)
    return Vector((r*math.cos(a), 0.55*r*math.sin(a), 0.36 + 0.12*math.sin(a*1.0 + i)))

def _ac_place(E, i, p, jit=(0, 0, 0), spin=0.0):
    k = E['parts']['key%d' % i]; k.location = p
    q = E['extra']['cam_q'] @ Euler((_r(jit[0]), _r(jit[1]), _r(jit[2] + spin))).to_quaternion()
    k.rotation_quaternion = q

def pose_autocomplete(E, anim, k):
    n = ANIMS[anim][0]
    for i in range(6):
        jit = ((i*37) % 21 - 10, (i*53) % 17 - 8, (i*29) % 25 - 12)
        if anim == 'idle':
            p = _ac_home(i, tau(k, n)/6); p.z += 0.03*math.sin(tau(k, n) + i); _ac_place(E, i, p, jit)
        elif anim == 'move':   # tighter, faster, leaning forward-down
            p = _ac_home(i, tau(k, n)/3)*0.78; p.z = 0.36 + 0.10*math.sin(tau(k, n)*2 + i*1.3); p.y -= 0.05
            _ac_place(E, i, p, (jit[0] + 18, jit[1], jit[2]))
        elif anim == 'attack':
            line = Vector((-0.42 + i*0.168, -0.05, 0.42))      # the tell: snap into a readable word line
            home = _ac_home(i, 0)
            if k <= 3:
                t = min(1, (k+1)/3.0); t = t*t*(3-2*t); p = home.lerp(line, t); _ac_place(E, i, p, tuple(j*(1-t) for j in jit))
            elif k <= 5:
                u = (k-3)/2.0; p = line + Vector((0, -0.42*u, -0.18*u)); _ac_place(E, i, p, (25*u, 0, 0))   # lunge
            else:
                u = (k-5)/2.0; p = (line + Vector((0, -0.42, -0.18))).lerp(home, u); _ac_place(E, i, p, tuple(j*u for j in jit))
        elif anim == 'hurt':
            home = _ac_home(i, 0); out = Vector((home.x, home.y, 0))*([0.45, 0.25, 0.08][k]); p = home + out
            _ac_place(E, i, p, (jit[0]*2, jit[1]*2, jit[2]*2 + [30, 15, 0][k]*(1 if i % 2 else -1)))
        elif anim == 'death':   # keys drop and tumble onto the floor
            home = _ac_home(i, 0); t = min(1.0, (k+1)/4.0)
            p = Vector((home.x*(1+0.5*t), home.y*(1+0.5*t), home.z*(1-t)**1.6 + 0.07*t)); _ac_place(E, i, p, (jit[0] + 90*t*(1 if i % 2 else -1), jit[1]+40*t, jit[2]))
    # emission: the tell brightens the letters and rims
    lv = 1.1; rv = 1.0
    if anim == 'attack': lv = [1.3, 2.0, 2.8, 3.4, 3.0, 2.0, 1.4, 1.1][k]; rv = [1.0, 1.5, 2.2, 2.8, 2.4, 1.6, 1.2, 1.0][k]
    if anim == 'hurt': lv = [3.5, 2.0, 1.2][k]
    if anim == 'death': lv = max(0.0, 1.1*(1 - k/5.0)); rv = max(0.0, 1 - k/4.0)
    for key, m in E['mats'].items():
        if key.startswith('top'): set_emit(m, lv)
    set_fade(E['mats']['rim'], rv); E['mats']['rim'].node_tree.nodes['Emission'].inputs[1].default_value = 1.2*max(rv, 0.01)

# ======================= 2. SYCOPHANT (vintage TV that grins, claps and copies you) =======================
def build_sycophant(index=6, s=1.25):
    E = _new('sycophant', index); root = E['root']
    hop = reg(E, 'hop', empty('hop', root))
    tv = kprop('televisionVintage', hop, (0, 0, 0.16), s=s, index=index); reg(E, 'tv', tv)
    W, D, Hh = tv['size']
    face = tex_mat('sy_face', EV5+'tex/v3/faceA_grin.png', emit=1.3); E['mats']['face'] = face
    pf = plane_tex(tv, face, (-0.045, -D/s/2 - 0.006, 0.1375), 0.24, 0.195, index=index)   # local (pre-scale)
    reg(E, 'face', pf)
    glove = mat('sy_glove', (236, 236, 240), rough=0.55); E['mats']['glove'] = glove
    for sx, nm in ((-1, 'gl'), (1, 'gr')):
        g = prim('uv_sphere', hop, glove, (sx*(W/2 + 0.07), -0.04, 0.16 + Hh*0.45), (1, 1, 1), index=index, smooth=True, radius=0.07, segments=16, ring_count=8)
        reg(E, nm, g)
        arm = prim('cylinder', hop, mat('sy_arm', P['slate'], rough=0.5), (sx*(W/2 + 0.02), -0.02, 0.16 + Hh*0.40), (1, 1, 1), (0, sx*70, 0), index=index, radius=0.014, depth=0.1)
    ant = empty('ant', tv); ant.location = (0.03, 0.0, Hh/s); reg(E, 'ant', ant)
    prim('cylinder', ant, glove, (0, 0, 0.09), (1, 1, 1), (0, -20, 0), index=index, radius=0.008, depth=0.2)
    tip = prim('uv_sphere', ant, glow_mat('sy_tip', P['pink'], 2.0), (-0.035, 0, 0.19), (1, 1, 1), index=index, radius=0.022, segments=10, ring_count=6)
    E['mats']['tip'] = tip.data.materials[0]
    # praise burst (attack payload): a ring of little hearts/stars that pops forward
    burst = empty('burst', root); burst.location = (0, -0.30, 0.42); reg(E, 'burst', burst)
    bm = glow_mat('sy_burst', P['pink'], 2.2); E['mats']['burst'] = bm
    for i in range(6):
        a = tau(i, 6); prim('cube', burst, bm, (0.16*math.cos(a), 0, 0.16*math.sin(a)), (0.05, 0.02, 0.05), (0, 45, 0), index=index, size=1)
    all_index(E); pose(E, 'idle', 0); return E

def pose_sycophant(E, anim, k):
    n = ANIMS[anim][0]; ph = tau(k, n)
    m = E['mats']; set_tex(m['face'], EV5+'tex/v3/faceA_grin.png'); show(E['parts']['burst'], False); set_fade(m['burst'], 1)
    clap = 0.0
    if anim == 'idle':
        off(E, 'hop', (0, 0, 0.025*(1+math.sin(ph)))); clap = 0.5 + 0.5*math.sin(ph*2); off(E, 'ant', r=(0, 10*math.sin(ph), 0))
    elif anim == 'move':
        h = abs(math.sin(ph/1)) * 0.10; sq = 1 - 0.08*math.cos(ph*2)
        off(E, 'hop', (0, 0, h), r=(8*math.sin(ph), 0, 0), s=(1/sq**0.5, 1/sq**0.5, sq)); off(E, 'ant', r=(0, 22*math.sin(ph+1), 0)); clap = 0.3
    elif anim == 'attack':   # tell: leans back + screen flares + gloves up framing the face; then a praise burst
        lean = [-4, -10, -14, -16, 8, 6, 2, 0][k]; off(E, 'hop', (0, 0, [0, 0.02, 0.04, 0.05, 0.0, 0.0, 0.0, 0][k]), r=(lean, 0, 0))
        set_emit(m['face'], [1.6, 2.4, 3.2, 3.8, 2.6, 1.8, 1.4, 1.3][k]); clap = [0.4, 0.8, 1.0, 1.0, 0.0, 0.2, 0.4, 0.5][k]
        if 4 <= k <= 6:
            b = E['parts']['burst']; show(b, True); u = (k-3)/3.0; l0 = E['rest']['burst'][0]
            b.location = l0 + Vector((0, -0.35*u, 0)); b.scale = (0.7+0.9*u,)*3; set_fade(m['burst'], 1 - 0.55*u)
    elif anim == 'hurt':
        off(E, 'hop', (0, 0.04*[1, 0.5, 0.1][k], 0), r=([-14, -7, -2][k], 0, [6, -4, 0][k])); set_tex(m['face'], EV5+'tex/static.png'); set_emit(m['face'], 1.6)
        clap = 0.0
    elif anim == 'death':   # tips over backwards, screen fades to static then off
        t = min(1, k/4.0); off(E, 'hop', (0, 0.12*t, -0.04*t), r=(-82*t, 0, 0)); set_tex(m['face'], EV5+'tex/static.png'); set_emit(m['face'], 1.4*(1-t))
        clap = 0.0
    for nm, sx in (('gl', -1), ('gr', 1)):
        off(E, nm, (-sx*0.06*clap, -0.04*clap, 0.10*clap if anim == 'attack' else 0.02*clap))
    if anim != 'attack' and anim not in ('hurt', 'death'): set_emit(m['face'], 1.3)

# ======================= 3. REFUSAL WARDEN (elite: filing-cabinet guard with a shield of refusals) =======================
def build_warden(index=3):
    E = _new('warden', index); root = E['root']
    body = reg(E, 'body', empty('body', root))
    metal = mat('wd_metal', (86, 98, 124), rough=0.38, metal=0.35); E['mats']['metal'] = metal
    tint_prop(kprop('kitchenCabinetDrawer', body, (0, 0, 0), s=1.0, index=index), (150, 176, 196))
    tor = reg(E, 'torso', empty('torso', body, (0, 0, 0.46)))
    tint_prop(kprop('kitchenCabinetDrawer', tor, (0, 0, 0), s=0.86, index=index), (150, 176, 196))
    head = reg(E, 'head', empty('head', tor, (0, 0.02, 0.40)))
    scr = kprop('computerScreen', head, (0, 0, 0), s=1.05, index=index)
    face = tex_mat('wd_face', EV5+'tex/v3/faceA_x.png', emit=1.4); E['mats']['face'] = face
    W_, D_, H_ = scr['size']
    reg(E, 'faceplane', plane_tex(head, face, (0, -0.022, 0.178), 0.33, 0.195, index=index))
    for sx, nm in ((-1, 'al'), (1, 'ar')):
        a = reg(E, nm, empty(nm, tor, (sx*0.31, -0.02, 0.30)))
        cube(a, metal, (0, 0, -0.16), (0.12, 0.12, 0.34), rot=(0, sx*10, 0), index=index, bevel=0.02)
        cube(a, metal, (sx*0.02, -0.02, -0.38), (0.17, 0.17, 0.15), index=index, bevel=0.03)
    # shield: open front arc with two soft coral edge lines (crisp, not a filled blob)
    import bmesh
    sh = reg(E, 'shield', empty('shield', root))
    shm = glow_mat('wd_shield', P['coral'], 0.35, 0.10); E['mats']['shield'] = shm
    edge = glow_mat('wd_edge', P['coral'], 1.8, 1.0); E['mats']['edge'] = edge
    def arc(obj, ycut=-0.25):
        bm = bmesh.new(); bm.from_mesh(obj.data)
        for f in list(bm.faces):
            if f.calc_center_median().y > ycut: bm.faces.remove(f)
        bm.to_mesh(obj.data); bm.free()
    c = prim('cylinder', sh, shm, (0, 0, 0.29), (1, 1, 1), index=index, vertices=40, radius=0.44, depth=0.44, end_fill_type='NOTHING'); arc(c, -0.20)
    for zz in (0.08, 0.51):
        t = prim('torus', sh, edge, (0, 0, zz), (1, 1, 1), index=index, major_radius=0.44, minor_radius=0.010, major_segments=64, minor_segments=6); arc(t, -0.22)
    # slam shockwave (attack payload)
    ring = reg(E, 'wave', prim('torus', root, glow_mat('wd_wave', P['coral'], 2.0), (0, -0.12, 0.02), (1, 1, 0.25), index=index, major_radius=0.3, minor_radius=0.014, major_segments=64, minor_segments=6))
    E['mats']['wave'] = ring.data.materials[0]
    all_index(E); pose(E, 'idle', 0); return E

def pose_warden(E, anim, k):
    n = ANIMS[anim][0]; ph = tau(k, n); m = E['mats']
    show(E['parts']['wave'], False); set_tex(m['face'], EV5+'tex/v3/faceA_x.png'); set_emit(m['face'], 1.4); set_fade(m['shield'], 0.10); set_fade(m['edge'], 1.0)
    if anim == 'idle':
        off(E, 'torso', (0, 0, 0.008*math.sin(ph)), r=(0, 1.5*math.sin(ph), 0)); off(E, 'head', r=(0, 0, 3*math.sin(ph)))
        for nm, sx in (('al', -1), ('ar', 1)): off(E, nm, r=(3*math.sin(ph + sx), 0, 0))
        set_fade(m['edge'], 0.85 + 0.15*math.sin(ph))
    elif anim == 'move':   # heavy rocking step
        off(E, 'body', (0, 0, 0.02*abs(math.sin(ph))), r=(0, 4*math.sin(ph), 0)); off(E, 'torso', r=(3, -2*math.sin(ph), 0))
        for nm, sx in (('al', -1), ('ar', 1)): off(E, nm, r=(14*math.sin(ph)*sx, 0, 0))
        off(E, 'shield', (0, 0, 0.01*math.sin(ph*2)))
    elif anim == 'attack':   # tell: both fists up overhead + face + shield brighten (frames 0-3), slam (4), shockwave (5-6)
        up = [0.25, 0.6, 0.9, 1.0, -0.15, -0.1, 0.0, 0.0][k]
        for nm in ('al', 'ar'): off(E, nm, (0, 0, 0.12*max(up, 0)), r=(-150*max(up, 0) + 25*min(up, 0)*-1, 0, 0))
        off(E, 'torso', r=([-3, -6, -9, -10, 10, 6, 3, 0][k], 0, 0)); off(E, 'body', (0, 0, [0, 0, 0.01, 0.02, -0.01, 0, 0, 0][k]))
        set_emit(m['face'], [1.8, 2.6, 3.4, 4.0, 3.0, 2.0, 1.6, 1.4][k])
        set_fade(m['shield'], [0.12, 0.16, 0.22, 0.28, 0.16, 0.12, 0.10, 0.10][k])
        if k in (4, 5, 6):
            w = E['parts']['wave']; show(w, True); u = (k-3)/3.0; w.scale = (0.75+0.75*u, 0.75+0.75*u, 0.25); set_fade(m['wave'], 1-0.6*u)
    elif anim == 'hurt':
        off(E, 'torso', (0, 0.04*[1, .5, .1][k], 0), r=([-8, -4, -1][k], 0, [4, -3, 0][k])); set_tex(m['face'], EV5+'tex/static.png')
        set_fade(m['edge'], [0.3, 0.7, 1.0][k])
    elif anim == 'death':   # shield drops, head slumps, torso sinks forward
        t = min(1, k/4.0); off(E, 'head', (0, -0.05*t, -0.06*t), r=(35*t, 0, 10*t)); off(E, 'torso', (0, -0.03*t, -0.10*t), r=(18*t, 0, 0))
        for nm, sx in (('al', -1), ('ar', 1)): off(E, nm, r=(10*t, sx*-15*t, 0))
        set_fade(m['shield'], 0.10*(1-t)); set_fade(m['edge'], 1-t); set_tex(m['face'], EV5+'tex/static.png'); set_emit(m['face'], 1.4*(1-t))

# ======================= 4. REDACTOR (shredder bruiser that sweeps black bars) =======================
def build_redactor(index=9):
    E = _new('redactor', index); root = E['root']
    blk = mat('rd_black', (22, 24, 32), rough=0.3, metal=0.3); red = mat('rd_red', P['coral'], emit=1.6); paper = mat('rd_paper', P['paper'], rough=0.7)
    E['mats'].update(black=blk, red=red, paper=paper)
    body = reg(E, 'body', empty('body', root))
    cube(body, blk, (0, 0, 0.38), (0.50, 0.38, 0.52), index=index, bevel=0.035)
    cube(body, blk, (0, 0, 0.67), (0.56, 0.42, 0.06), index=index, bevel=0.015)
    cube(body, mat('rd_slot', (2, 2, 4)), (0, 0, 0.703), (0.40, 0.05, 0.02), index=index)
    strips = reg(E, 'strips', empty('strips', body, (0, 0, 0.70)))
    for i in range(6):
        st = cube(strips, paper, (-0.15 + i*0.06, 0.0, 0.10 + 0.03*(i % 3)), (0.03, 0.006, 0.18 + 0.05*(i % 3)), rot=(-12 + 5*i, 7*(i-3), 0), index=index)
    vis = tex_mat('rd_visor', EV5+'tex/redact_visor.png', emit=1.0); E['mats']['visor'] = vis
    plane_tex(body, vis, (0, -0.192, 0.48), 0.42, 0.15, index=index)
    cube(body, red, (0, -0.193, 0.30), (0.50, 0.01, 0.022), index=index)
    for sx, nm in ((-1, 'fl'), (1, 'fr')):
        reg(E, nm, cube(root, blk, (sx*0.15, -0.03, 0.06), (0.16, 0.24, 0.12), index=index, bevel=0.02))
    al = reg(E, 'al', empty('al', body, (-0.30, -0.02, 0.56)))
    cube(al, blk, (0, 0, -0.14), (0.08, 0.08, 0.30), rot=(0, -10, 0), index=index, bevel=0.015)
    ar = reg(E, 'ar', empty('ar', body, (0.30, -0.02, 0.56)))
    cube(ar, blk, (0, 0, -0.14), (0.08, 0.08, 0.30), rot=(0, 10, 0), index=index, bevel=0.015)
    mk = empty('marker', ar, (0.03, -0.10, -0.30)); mk.rotation_euler = (_r(-70), 0, 0)
    prim('cylinder', mk, blk, (0, 0, 0), index=index, radius=0.045, depth=0.36, vertices=16)
    prim('cylinder', mk, red, (0, 0, -0.17), index=index, radius=0.047, depth=0.07, vertices=16)
    # the redaction bar (attack payload): a long black bar with a coral edge sweeping forward
    bar = reg(E, 'bar', empty('bar', root, (0, -0.30, 0.30)))
    bm = mat('rd_bar', (10, 10, 16), rough=0.4); cube(bar, bm, (0, 0, 0), (0.70, 0.12, 0.10), index=index, bevel=0.012)
    be = glow_mat('rd_baredge', P['coral'], 1.5); E['mats']['baredge'] = be
    for yy in (-0.058, 0.058): cube(bar, be, (0, yy, 0.052), (0.71, 0.012, 0.008), index=index)
    cube(bar, be, (0, -0.062, 0), (0.71, 0.008, 0.10), index=index)
    hov = reg(E, 'hover', empty('hover', body, (0, 0, 0)))
    for i, (bx, bz, w) in enumerate(((-0.38, 0.92, 0.26), (0.36, 1.00, 0.22))):
        cube(hov, blk, (bx, -0.04, bz), (w, 0.04, 0.06), index=index, bevel=0.008); cube(hov, red, (bx, -0.04, bz-0.032), (w+0.01, 0.045, 0.007), index=index)
    all_index(E); pose(E, 'idle', 0); return E

def pose_redactor(E, anim, k):
    n = ANIMS[anim][0]; ph = tau(k, n); m = E['mats']
    show(E['parts']['bar'], False); set_emit(m['red'], 1.6); set_emit(m['visor'], 1.0)
    if anim == 'idle':
        off(E, 'hover', (0, 0, 0.02*math.sin(ph))); off(E, 'strips', r=(5*math.sin(ph*2), 0, 0)); off(E, 'body', (0, 0, 0.005*math.sin(ph)))
    elif anim == 'move':   # waddle
        off(E, 'body', (0, 0, 0.015*abs(math.sin(ph))), r=(0, 5*math.sin(ph), 0))
        off(E, 'fl', (0, -0.05*math.sin(ph), 0.03*max(0, math.sin(ph)))); off(E, 'fr', (0, 0.05*math.sin(ph), 0.03*max(0, -math.sin(ph))))
        off(E, 'hover', (0, 0, 0.02*math.sin(ph*2))); off(E, 'strips', r=(10*math.sin(ph*2), 0, 0))
    elif anim == 'attack':   # tell: marker arm lifts high, red stripe + visor flare (0-3); bar sweeps forward (4-6)
        lift = [0.3, 0.6, 0.9, 1.0, 0.2, 0.0, 0.0, 0.0][k]
        off(E, 'ar', r=(-120*lift, 0, 0)); off(E, 'body', r=([-2, -4, -6, -7, 8, 6, 3, 0][k], 0, 0))
        set_emit(m['red'], [2.0, 2.8, 3.6, 4.2, 3.0, 2.2, 1.8, 1.6][k]); set_emit(m['visor'], [1.2, 1.6, 2.0, 2.4, 1.8, 1.4, 1.1, 1.0][k])
        if 4 <= k <= 6:
            b = E['parts']['bar']; show(b, True); u = (k-3)/3.0; l0 = E['rest']['bar'][0]
            b.location = l0 + Vector((0, -0.30*u, -0.12*u)); b.scale = (0.7+0.5*u, 1, 1); set_fade(m['baredge'], 1-0.25*u)
    elif anim == 'hurt':
        off(E, 'body', (0, 0.03*[1, .5, .1][k], 0), r=([-8, -4, -1][k], 0, [5, -3, 0][k])); off(E, 'strips', r=(30*[1, .5, 0][k], 0, 0))
        set_emit(m['visor'], [0.2, 0.7, 1.0][k])
    elif anim == 'death':   # bars fall, body sinks and tilts, light dies
        t = min(1, k/4.0); off(E, 'hover', (0, 0, -0.75*t*t), r=(0, 30*t, 0)); off(E, 'body', (0, 0, -0.05*t), r=(12*t, 0, -8*t))
        set_emit(m['red'], 1.6*(1-t)); set_emit(m['visor'], 1.0*(1-t))

# ======================= 5. HALLUCINATOR (over-confident speech bubble with too many eyes) =======================
def build_hallucinator(index=8):
    E = _new('hallucinator', index); root = E['root']
    fl = reg(E, 'float', empty('float', root, (0, 0, 0.58)))
    m = bpy.data.materials.new('ha_irid'); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs[0].default_value = 0.45
    cr = nt.nodes.new('ShaderNodeValToRGB'); cr.color_ramp.elements[0].color = (*L3(P['lav']), 1); cr.color_ramp.elements[1].color = (*L3(P['mint']), 1)
    el = cr.color_ramp.elements.new(0.55); el.color = (*L3((196, 150, 230)), 1)
    nt.links.new(lw.outputs['Facing'], cr.inputs[0]); nt.links.new(cr.outputs[0], b.inputs['Base Color']); nt.links.new(cr.outputs[0], b.inputs['Emission Color'])
    b.inputs['Emission Strength'].default_value = 0.35; b.inputs['Roughness'].default_value = 0.2; b.inputs['Coat Weight'].default_value = 0.8; m['base_emit'] = 0.35
    E['mats']['irid'] = m
    bodyo = reg(E, 'blob', prim('uv_sphere', fl, m, (0, 0, 0), (1.2, 0.8, 0.9), index=index, smooth=True, radius=0.25, segments=32, ring_count=16))
    prim('cone', bodyo, m, (-0.15, 0, -0.24), (1, 1, 1), (200, -25, 0), index=index, vertices=12, radius1=0.08, radius2=0.0, depth=0.2)
    white = mat('ha_eyew', (240, 242, 250), rough=0.25, emit=0.25, emit_rgb=(255, 255, 255)); pup = mat('ha_eyep', (20, 12, 40), rough=0.2)
    E['mats']['eyew'] = white
    eyes = reg(E, 'eyes', empty('eyes', fl))
    rnd = random.Random(9)
    for i, (ex, ez, er) in enumerate(((-0.12, 0.05, 0.058), (0.04, 0.09, 0.07), (0.17, 0.0, 0.048), (-0.03, -0.07, 0.042), (0.12, -0.10, 0.032))):
        e = prim('uv_sphere', eyes, white, (ex*1.2, -0.20 + abs(ex)*0.22, ez), (1, 1, 1), index=index, smooth=True, radius=er, segments=16, ring_count=8)
        reg(E, 'eye%d' % i, e)
        prim('uv_sphere', e, pup, (rnd.uniform(-0.25, 0.25)*er, -0.62*er, rnd.uniform(-0.2, 0.2)*er), (1, 1, 1), index=index, smooth=True, radius=0.5*er, segments=12, ring_count=6)
    cards = reg(E, 'cards', empty('cards', fl))
    cit = tex_mat('ha_cit', EV5+'tex/citations.png', emit=0.35, rough=0.7); E['mats']['cit'] = cit
    for i, (cx, cz, a) in enumerate(((0.40, 0.10, -12), (-0.40, -0.04, 10), (0.0, 0.33, 4))):
        c = plane_tex(cards, cit, (cx, -0.06, cz), 0.30, 0.09, rot=(90, a, 0), index=index); reg(E, 'card%d' % i, c)
    # attack payload: a fake glowing 'exit door' card it spits out
    door = reg(E, 'door', plane_tex(root, tex_mat('ha_door', EV5+'tex/fakedoor.png', emit=1.6), (0, -0.35, 0.42), 0.32, 0.46, index=index))
    E['mats']['door'] = door.data.materials[0]
    all_index(E); pose(E, 'idle', 0); return E

def pose_hallucinator(E, anim, k):
    n = ANIMS[anim][0]; ph = tau(k, n); m = E['mats']
    show(E['parts']['door'], False); set_emit(m['eyew'], 0.25); set_emit(m['irid'], 0.35)
    def orbit(sp, rr=1.0):
        for i in range(3):
            o = E['parts']['card%d' % i]; l0 = E['rest']['card%d' % i][0]; a = sp + tau(i, 3)
            o.location = Vector((l0.x*rr, l0.y, l0.z)) + Vector((0.03*math.cos(a), 0, 0.03*math.sin(a)))
    if anim == 'idle':
        off(E, 'float', (0, 0, 0.035*math.sin(ph))); off(E, 'blob', s=(1 + 0.02*math.sin(ph*2), 1, 1 - 0.02*math.sin(ph*2))); orbit(ph)
    elif anim == 'move':
        off(E, 'float', (0, 0, 0.03*math.sin(ph*2)), r=(10, 0, 6*math.sin(ph))); orbit(ph*2, 1.1)
    elif anim == 'attack':   # tell: eyes flare + body inflates + cards spread (0-3); spits a fake door forward (4-6)
        inf = [1.03, 1.08, 1.13, 1.17, 0.92, 0.96, 1.0, 1.0][k]; off(E, 'blob', s=(inf, inf, inf)); off(E, 'float', (0, 0, [0, 0.02, 0.04, 0.05, -0.02, 0, 0, 0][k]))
        set_emit(m['eyew'], [0.6, 1.3, 2.2, 3.0, 2.0, 1.0, 0.5, 0.25][k]); set_emit(m['irid'], [0.45, 0.6, 0.8, 1.0, 0.7, 0.5, 0.4, 0.35][k])
        orbit(0, [1.05, 1.15, 1.25, 1.3, 1.0, 1.0, 1.0, 1.0][k])
        if 4 <= k <= 6:
            d = E['parts']['door']; show(d, True); u = (k-3)/3.0; l0 = E['rest']['door'][0]
            s0 = E['rest']['door'][2]; d.location = l0 + Vector((0, -0.22*u, -0.10*u)); d.scale = (s0.x*(0.6+0.5*u), s0.y*(0.6+0.5*u), 1)
    elif anim == 'hurt':   # squash, eyes squeeze shut
        sq = [0.78, 0.9, 0.98][k]; off(E, 'blob', s=(1/sq**0.5, 1, sq)); off(E, 'eyes', s=(1, 1, [0.25, 0.6, 1.0][k])); orbit(0, [1.3, 1.15, 1.0][k])
    elif anim == 'death':   # deflates and pops; cards flutter down
        t = min(1, k/4.0); sc_ = max(0.05, 1 - 0.95*t*t); off(E, 'float', (0, 0, -0.25*t)); off(E, 'blob', s=(sc_*(1+0.3*t), sc_, sc_)); off(E, 'eyes', s=(sc_, sc_, sc_*0.5))
        for i in range(3):
            o = E['parts']['card%d' % i]; l0 = E['rest']['card%d' % i][0]; o.location = l0 + Vector((0.1*t*(i-1), 0, -0.55*t)); o.rotation_euler = Euler((_r(90+60*t), _r(40*t*(i-1)), 0))
        set_emit(m['eyew'], 0.25*(1-t))

# ======================= 6. CARET (ALLY: the blinking cursor that learned from Noor's unsent drafts) =======================
def build_caret(index=2):
    E = _new('caret', index); root = E['root']
    fl = reg(E, 'float', empty('float', root, (0, 0, 0.50)))
    bodym = mat('ca_body', P['ice'], rough=0.3, emit=0.9, emit_rgb=(170, 236, 244)); E['mats']['body'] = bodym
    beam = reg(E, 'beam', empty('beam', fl))
    cube(beam, bodym, (0, 0, 0), (0.075, 0.06, 0.38), index=index, bevel=0.012)
    cube(beam, bodym, (0, 0, 0.19), (0.19, 0.06, 0.05), index=index, bevel=0.012)
    cube(beam, bodym, (0, 0, -0.19), (0.19, 0.06, 0.05), index=index, bevel=0.012)
    eye = mat('ca_eye', (18, 30, 44), rough=0.4)
    eyes = reg(E, 'eyes', empty('eyes', beam, (0, -0.034, 0.07)))
    for ex in (-0.022, 0.022): cube(eyes, eye, (ex, 0, 0), (0.026, 0.012, 0.075), index=index)
    und = reg(E, 'under', cube(fl, glow_mat('ca_under', P['cyan'], 1.6), (0.0, 0, -0.30), (0.20, 0.04, 0.03), index=index))
    E['mats']['under'] = und.data.materials[0]
    ring = reg(E, 'ring', prim('torus', root, glow_mat('ca_ring', P['cyan'], 1.6), (0, 0, 0.02), (1, 1, 0.3), index=index, major_radius=0.18, minor_radius=0.01, major_segments=48, minor_segments=6))
    E['mats']['ring'] = ring.data.materials[0]
    all_index(E); pose(E, 'idle', 0); return E

def pose_caret(E, anim, k):
    n = CARET_ANIMS[anim][0]; ph = tau(k, n); m = E['mats']
    show(E['parts']['ring'], False); show(E['parts']['under'], False); set_emit(m['body'], 0.9)
    if anim == 'idle':   # gentle bob, slow cursor blink (dims, never vanishes), one eye-blink
        off(E, 'float', (0, 0, 0.03*math.sin(ph))); set_emit(m['body'], [0.9, 0.9, 0.7, 0.45, 0.6, 0.85][k])
        off(E, 'eyes', s=(1, 1, 0.15 if k == 3 else 1))
    elif anim == 'move':   # leans into the direction of travel, underscore trail
        off(E, 'float', (0, 0, 0.02*math.sin(ph*2)), r=(18, 0, 0)); E['parts']['under'].hide_render = False
        off(E, 'under', (0, 0.06, 0.02*math.sin(ph)), s=(1.0 + 0.3*math.sin(ph), 1, 1)); set_fade(m['under'], 0.7)
    elif anim == 'assist':   # ping: hop + underline draws out + soft ring pulse (highlights a word for Noor)
        off(E, 'float', (0, 0, [0, 0.05, 0.09, 0.06, 0.0, 0.0, 0.0, 0.0][k]), s=(1, 1, [1, 0.92, 1.06, 1.0, 1.0, 1, 1, 1][k]))
        u = min(1, max(0, (k-1)/3.0)); show(E['parts']['under'], k >= 1)
        off(E, 'under', (0, 0, -0.02), s=(0.3 + 1.6*u, 1, 1)); set_fade(m['under'], 1 - 0.5*max(0, (k-5)/2.0))
        set_emit(m['body'], [1.0, 1.4, 1.8, 1.6, 1.3, 1.1, 1.0, 0.9][k])
        if 3 <= k <= 7:
            r = E['parts']['ring']; show(r, True); v = (k-3)/4.0; r.scale = (0.8+2.0*v, 0.8+2.0*v, 0.3); set_fade(m['ring'], 0.9*(1-v))
    elif anim == 'hurt':   # flicker + squash (when Noor takes a hit)
        off(E, 'float', (0, 0.02*[1, .5, 0][k], -0.02*[1, .5, 0][k]), r=(0, [12, -8, 0][k], 0), s=(1, 1, [0.8, 0.9, 1][k])); set_emit(m['body'], [0.2, 1.6, 0.9][k])

BUILD = dict(autocomplete=build_autocomplete, sycophant=build_sycophant, warden=build_warden, redactor=build_redactor,
             hallucinator=build_hallucinator, caret=build_caret)
POSE = dict(autocomplete=pose_autocomplete, sycophant=pose_sycophant, warden=pose_warden, redactor=pose_redactor,
            hallucinator=pose_hallucinator, caret=pose_caret)
def pose(E, anim, k):
    reset(E); POSE[E['name']](E, anim, k); bpy.context.view_layer.update()
