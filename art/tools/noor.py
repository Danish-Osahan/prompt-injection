# art-v5: Noor (and Fern, her hologram copy) built in Blender on top of Kenney Mini Characters
# 'character-female-d' (CC0). Everything added here is original modelling:
#   recoloured skin/hair/clothes, oversized knit cardigan shell (skinned to the same rig, sweater-paw sleeves),
#   messy bun extension + pencil through it + face-framing locks, headset resting round the neck, lanyard + ID badge.
# Use from a Blender script:  exec(open(.../noor.py).read()); root, arm, meshes = build_noor(...)
import bpy, bmesh, math, os, random
from mathutils import Vector, Matrix, Euler
_R = math.radians
V4 = '/workspace/games/prompt-injection/art-v5/'
MC = '/workspace/games/_downloads/mini-characters/Models/GLB format/'

def s2l(c):  # sRGB 0-255 -> linear 0-1
    c = c/255.0; return c/12.92 if c <= 0.04045 else ((c+0.055)/1.055)**2.4
def lin(rgb): return tuple(s2l(v) for v in rgb)

NOOR = dict(skin=(205, 140, 100), hair=(80, 50, 35), hair_hi=(112, 76, 54), pants=(52, 44, 62), tee=(226, 218, 204))

def _mat(name, rgb, rough=0.5, emit=0.0, metal=0.0, emit_rgb=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*lin(rgb), 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit: b.inputs['Emission Color'].default_value = (*lin(emit_rgb or rgb), 1); b.inputs['Emission Strength'].default_value = emit
    return m

def _img_mat(name, path, rough=0.7, interp='Linear', sheen=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(path, check_existing=True); t.interpolation = interp
    nt.links.new(t.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = rough
    if sheen: b.inputs['Sheen Weight'].default_value = sheen; b.inputs['Sheen Roughness'].default_value = 0.5
    return m, t

def holo_shader(name, rgb=(80, 200, 255), strength=2.2, alpha=0.55, scan=90.0, fres=0.35, tex=None, space=None, dissolve=None):
    """Emissive hologram: fresnel-boosted edges, horizontal scanlines in object Z, partial transparency."""
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL': nt.nodes.remove(n)
    out = nt.nodes['Material Output']
    tc = nt.nodes.new('ShaderNodeTexCoord'); tc.object = space; sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Object'], sep.inputs[0])
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = scan; nt.links.new(sep.outputs['Z'], mul.inputs[0])
    sn = nt.nodes.new('ShaderNodeMath'); sn.operation = 'SINE'; nt.links.new(mul.outputs[0], sn.inputs[0])
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = -1; mr.inputs['To Min'].default_value = 0.35; mr.inputs['To Max'].default_value = 1.0
    nt.links.new(sn.outputs[0], mr.inputs['Value'])
    lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = fres
    fr = nt.nodes.new('ShaderNodeMath'); fr.operation = 'MULTIPLY_ADD'; fr.inputs[1].default_value = 1.6; fr.inputs[2].default_value = 0.45
    nt.links.new(lw.outputs['Facing'], fr.inputs[0])
    k = nt.nodes.new('ShaderNodeMath'); k.operation = 'MULTIPLY'; nt.links.new(mr.outputs[0], k.inputs[0]); nt.links.new(fr.outputs[0], k.inputs[1])
    if dissolve:   # fade out towards the feet (z0 -> z1 in 'space' coordinates)
        dm = nt.nodes.new('ShaderNodeMapRange'); dm.interpolation_type = 'SMOOTHSTEP'; dm.inputs['From Min'].default_value = dissolve[0]; dm.inputs['From Max'].default_value = dissolve[1]
        nt.links.new(sep.outputs['Z'], dm.inputs['Value']); k2 = nt.nodes.new('ShaderNodeMath'); k2.operation = 'MULTIPLY'
        nt.links.new(k.outputs[0], k2.inputs[0]); nt.links.new(dm.outputs[0], k2.inputs[1]); k = k2
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Color'].default_value = (*lin(rgb), 1)
    if tex is not None:   # tint the hologram by a texture (keeps Noor's design readable inside the glow)
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = tex; mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'
        mx.inputs[0].default_value = 0.65; nt.links.new(t.outputs['Color'], mx.inputs[7]); mx.inputs[6].default_value = (*lin(rgb), 1)
        hs = nt.nodes.new('ShaderNodeHueSaturation'); hs.inputs['Value'].default_value = 1.25; hs.inputs['Saturation'].default_value = 1.3
        nt.links.new(mx.outputs[2], hs.inputs['Color']); nt.links.new(hs.outputs[0], em.inputs['Color'])
        uvn = nt.nodes.new('ShaderNodeUVMap'); nt.links.new(uvn.outputs[0], t.inputs[0]); m['uvnode'] = uvn.name
    st = nt.nodes.new('ShaderNodeMath'); st.operation = 'MULTIPLY'; st.inputs[1].default_value = strength; nt.links.new(k.outputs[0], st.inputs[0])
    nt.links.new(st.outputs[0], em.inputs['Strength'])
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    fa = nt.nodes.new('ShaderNodeMath'); fa.operation = 'MULTIPLY'; fa.inputs[1].default_value = alpha; nt.links.new(k.outputs[0], fa.inputs[0])
    cl = nt.nodes.new('ShaderNodeClamp'); nt.links.new(fa.outputs[0], cl.inputs[0])
    mx2 = nt.nodes.new('ShaderNodeMixShader'); nt.links.new(cl.outputs[0], mx2.inputs[0]); nt.links.new(tr.outputs[0], mx2.inputs[1]); nt.links.new(em.outputs[0], mx2.inputs[2])
    nt.links.new(mx2.outputs[0], out.inputs[0]); m.blend_method = 'BLEND'
    try: m.surface_render_method = 'BLENDED'
    except Exception: pass
    return m

def _recolour(meshes, table):
    import numpy as np
    done = {}
    for o in meshes:
        for sl in o.material_slots:
            m = sl.material
            if not m: continue
            if m.name in done: sl.material = done[m.name]; continue
            m2 = m.copy(); done[m.name] = m2; sl.material = m2
            for n in m2.node_tree.nodes:
                if n.type == 'TEX_IMAGE' and n.image:
                    src = n.image; px = np.empty(len(src.pixels), dtype=np.float32); src.pixels.foreach_get(px)
                    W0, H0 = src.size; px = px.reshape(H0, W0, 4)
                    im = bpy.data.images.new('noor_colormap', W0, H0, alpha=True)
                    for (c0, c1), tgt in table:     # bottom band of the Kenney colormap (Blender row 0..127)
                        reg = px[0:128, c0*32:(c1+1)*32, :3]
                        base = reg.max() + 1e-6; lum = reg.max(2, keepdims=True)/base
                        px[0:128, c0*32:(c1+1)*32, :3] = np.clip(lum*np.array(tgt, dtype=np.float32)/255, 0, 1)
                    im.pixels.foreach_set(px.ravel()); im.update(); im.pack(); n.image = im; n.interpolation = 'Closest'
            b = m2.node_tree.nodes.get('Principled BSDF')
            if b: b.inputs['Roughness'].default_value = 0.62

def _dominant_group(o):
    gi = {g.index: g.name for g in o.vertex_groups}
    return [gi[max(v.groups, key=lambda g: g.weight).group] if len(v.groups) else 'root' for v in o.data.vertices]

def _uv_col(o):
    me = o.data; uv = me.uv_layers.active.data; res = []
    for p in me.polygons:
        u = sum(uv[l].uv.x for l in p.loop_indices)/p.loop_total
        res.append(int(u*16))
    return res

def _bone_parent(o, arm, bone):
    bpy.context.view_layer.update()
    mw = o.matrix_world.copy(); o.parent = arm; o.parent_type = 'BONE'; o.parent_bone = bone; o.matrix_world = mw

def _cardigan(body, arm, mat):
    """Duplicate jacket faces (torso + arms), weld, inflate, lengthen the hem, extend sleeves over the hands."""
    groups = _dominant_group(body); cols = _uv_col(body)
    me = body.data.copy(); ob = bpy.data.objects.new('noor_cardigan', me); bpy.context.scene.collection.objects.link(ob)
    ob.matrix_world = body.matrix_world.copy()
    for g in body.vertex_groups: ob.vertex_groups.new(name=g.name)
    # copy weights (mesh copy keeps them; vertex_groups names are needed)
    bm = bmesh.new(); bm.from_mesh(me)
    bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
    dl = bm.verts.layers.deform.active
    gi = {g.index: g.name for g in body.vertex_groups}
    def dom(v):
        d = v[dl]
        n = gi[max(d.items(), key=lambda kv: kv[1])[0]] if len(d) else 'root'
        return 'torso' if n.startswith('leg') else n
    kill = []
    for f in bm.faces:
        gs = {dom(v) for v in f.verts}
        if cols[f.index] not in (2, 3) or not gs <= {'torso', 'arm-left', 'arm-right'}: kill.append(f)
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
    bm.normal_update()
    # inflate
    for v in bm.verts:
        g = dom(v); d = 0.016 if g == 'torso' else 0.020
        v.co += v.normal*d
    # longer flared hem + puffy sweater-paw sleeves
    for v in bm.verts:
        g = dom(v)
        if g == 'torso' and v.co.z < 0.20:
            v.co.z -= 0.030; v.co.x *= 1.12; v.co.y = 0.03 + (v.co.y-0.03)*1.30
            # hem follows the legs a little (cloth-like), so swinging legs don't poke through
            gidx = {g_.name: g_.index for g_ in body.vertex_groups}; dd = v[dl]
            for kk in list(dd.keys()): del dd[kk]
            side = 'leg-left' if v.co.x > 0 else 'leg-right'
            if abs(v.co.x) < 0.03:
                dd[gidx['torso']] = 0.86; dd[gidx['leg-left']] = 0.07; dd[gidx['leg-right']] = 0.07
            else:
                dd[gidx['torso']] = 0.74; dd[gidx[side]] = 0.26
        if g in ('arm-left', 'arm-right'):
            ax = abs(v.co.x)
            if ax > 0.29: v.co.x = math.copysign(max(ax, 0.352), v.co.x); v.co.y = -0.012 + (v.co.y+0.012)*1.12; v.co.z = 0.288 + (v.co.z-0.288)*1.12
    # rest-pose UVs: front | back | sleeve regions of cardigan.png
    zs = [v.co.z for v in bm.verts if dom(v) == 'torso']; z0, z1 = min(zs), max(zs)
    uvl = bm.loops.layers.uv.active
    for f in bm.faces:
        gs = [dom(v) for v in f.verts]; isarm = gs.count('torso') < len(gs)/2
        n = f.normal
        for l in f.loops:
            c = l.vert.co
            if isarm:
                t = (abs(c.x)-0.10)/(0.352-0.10)
                l[uvl].uv = (0.8 + 0.2*min(max(t, 0), 1)*0.999, 0.5 + 0.4*(c.z-0.288)/0.12 + (0.2 if n.y > 0.3 else 0))
            else:
                v = (c.z - z0)/(z1 - z0)
                if n.y < -0.45:   u = 0.2 + 0.4*(c.x/0.40)
                elif n.y > 0.45:  u = 0.6 - 0.4*(c.x/0.40)
                else:             u = 0.6 + 0.1*(c.y/0.2)
                if n.z > 0.6: v = 0.97
                l[uvl].uv = (min(max(u, 0.001), 0.999), min(max(v, 0.001), 0.999))
    bm.to_mesh(me); bm.free()
    me.materials.clear(); me.materials.append(mat)
    for p in me.polygons: p.use_smooth = False
    md = ob.modifiers.new('arm', 'ARMATURE'); md.object = arm
    return ob

V6_READ = True; EAR_X = 0.215; HAIR_CUT_Z = 0.585; HAIR_CUT_X = 0.12
HEAD_K = 0.78      # v5: head scale about the neck (Kenney chibi head was taller than the body)
HEAD_TILT = -16.0  # v5: chin up (deg about X) so the face reads from the 38 deg camera
NECK = Vector((0.0, 0.002, 0.343))
def head_matrix():
    T = Matrix.Translation(NECK)
    return T @ Matrix.Rotation(_R(HEAD_TILT), 4, 'X') @ Matrix.Scale(HEAD_K, 4) @ T.inverted()

def _shrink_head(arm, head, objs):
    M = head_matrix()
    head.data.transform(head.matrix_world.inverted() @ M @ head.matrix_world); head.data.update()
    for o in list(bpy.data.objects):
        if o.parent == arm and o.parent_type == 'BONE' and o.parent_bone == 'head':
            o.matrix_world = M @ o.matrix_world
    bpy.context.view_layer.update()

def build_noor(name='noor', holo=False, hcol=(90, 210, 255)):
    before = set(bpy.data.objects); bacts = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=MC+'character-female-d.glb')
    new = [o for o in bpy.data.objects if o not in before]
    arm = [o for o in new if o.type == 'ARMATURE'][0]
    junk = [o for o in new if (o.type == 'MESH' and o.name.split('.')[0] in ('Icosphere', 'Cube')) or o.type in ('CAMERA', 'LIGHT')]
    for o in junk: bpy.data.objects.remove(o, do_unlink=True)
    body = [o for o in arm.children if o.type == 'MESH' and 'body' in o.name][0]
    head = [o for o in arm.children if o.type == 'MESH' and 'head' in o.name][0]
    arm.name = name + '_rig'
    arm['actions'] = {a.name.split('_')[0]: a.name for a in bpy.data.actions if a not in bacts}
    arm.data.pose_position = 'REST'; bpy.context.view_layer.update()
    C = NOOR
    _recolour([body, head], [((2, 3), C['pants']), ((8, 9), C['tee']), ((10, 11), C['hair']), ((14, 15), C['skin'])])
    extra = []
    # ---- cardigan ----
    cm, ct = _img_mat('noor_knit', V4+'tex/cardigan.png', rough=0.85, sheen=0.6)
    card = _cardigan(body, arm, cm); card.parent = arm; extra.append(card)
    inner = _mat('noor_knit_inner', (150, 104, 40), rough=0.9)
    body.data.materials.append(inner); ii = len(body.data.materials)-1
    groups = _dominant_group(body); cols = _uv_col(body)
    for p in body.data.polygons:
        gs = {groups[v] for v in p.vertices}
        if cols[p.index] in (2, 3) and gs <= {'torso', 'arm-left', 'arm-right'}: p.material_index = ii
    # hair faces of the Kenney head get a strand shader (warm brown, anisotropic sheen)
    hs_ = bpy.data.materials.new('noor_hair_strands'); hs_.use_nodes = True; nt = hs_.node_tree; b = nt.nodes['Principled BSDF']
    wv = nt.nodes.new('ShaderNodeTexNoise'); wv.inputs['Scale'].default_value = 26.0; wv.inputs['Detail'].default_value = 2
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1.0, 0.14, 0.14)
    tc = nt.nodes.new('ShaderNodeTexCoord'); nt.links.new(tc.outputs['Object'], mp.inputs['Vector']); nt.links.new(mp.outputs[0], wv.inputs['Vector'])
    cr = nt.nodes.new('ShaderNodeValToRGB'); cr.color_ramp.elements[0].position = 0.35; cr.color_ramp.elements[1].position = 0.7; cr.color_ramp.elements[0].color = (*lin(C['hair']), 1); cr.color_ramp.elements[1].color = (*lin(C['hair_hi']), 1)
    nt.links.new(wv.outputs['Fac'], cr.inputs[0]); nt.links.new(cr.outputs[0], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.42; b.inputs['Anisotropic'].default_value = 0.6; b.inputs['Coat Weight'].default_value = 0.0
    head.data.materials.append(hs_); hi = len(head.data.materials)-1
    hcols = _uv_col(head)
    for p in head.data.polygons:
        if hcols[p.index] in (10, 11): p.material_index = hi
    if V6_READ:   # v6: hair pulled up into the bun -> the lower sides and nape of the Kenney hair helmet become skin
        sk6 = _mat('noor_skin6h', C['skin'], rough=0.6); head.data.materials.append(sk6); si = len(head.data.materials)-1
        mwh = head.matrix_world
        for p in head.data.polygons:
            if p.material_index != hi: continue
            c = mwh @ p.center
            if (c.z < HAIR_CUT_Z and abs(c.x) > HAIR_CUT_X) or (c.z < HAIR_CUT_Z + 0.05 and c.y > 0.06): p.material_index = si
    # ---- hair: messy bun around the Kenney bun + face-framing locks + flyaways ----
    hm = hs_; hm2 = _mat('noor_hair_hi', C['hair_hi'], rough=0.4)
    hv = [head.matrix_world @ v.co for v in head.data.vertices]
    bun = [p for p in hv if p.y > 0.16 and p.z > 0.5]
    bc = sum(bun, Vector())/max(len(bun), 1) if bun else Vector((0, 0.2, 0.66))
    rnd = random.Random(3)
    lumps = [(0.00, 0.02, 0.07, 0.085), (-0.07, 0.03, 0.03, 0.065), (0.07, 0.01, 0.04, 0.07), (0.02, 0.07, -0.01, 0.07), (-0.04, 0.05, 0.08, 0.055), (0.05, 0.05, 0.09, 0.05)]
    for (dx, dy, dz, r) in lumps:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=r, location=bc + Vector((dx, dy, dz)))
        o = bpy.context.object; o.rotation_euler = (rnd.random()*3, rnd.random()*3, rnd.random()*3); o.scale = (0.9, 0.82, 0.72)
        o.data.materials.append(hm if rnd.random() < 0.6 else hm2); extra.append(o)
        _bone_parent(o, arm, 'head')
    def strand(pts, r=0.011, mat=hm, flat=0.6):
        cu = bpy.data.curves.new('strand', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r; cu.bevel_resolution = 1
        sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts)-1)
        for bp, p in zip(sp.bezier_points, pts): bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'
        sp.bezier_points[-1].radius = 0.25
        o = bpy.data.objects.new('strand', cu); bpy.context.scene.collection.objects.link(o); o.data.materials.append(mat)
        _bone_parent(o, arm, 'head'); extra.append(o); return o
    for s in (-1, 1):   # face-framing locks falling at the front corners of the face
        o = strand([(s*0.175, -0.185, 0.62), (s*0.192, -0.198, 0.53), (s*0.188, -0.196, 0.45), (s*0.172, -0.186, 0.405)], r=(0.016 if V6_READ else 0.024), mat=hm)
    for k in range(3):  # short flyaway loops out of the bun (silhouette breakers)
        a = k*2.1 + 0.4; p0 = bc + Vector((0.03*math.cos(a), 0.03, 0.08)); d = Vector((math.cos(a), 0.3, 0.6))
        strand([p0, p0 + d*0.07 + Vector((0, 0, 0.03)), p0 + Vector((math.cos(a)*0.09, 0.05, 0.0))], r=0.008, mat=hm2)
    # ---- big round glasses (tired writer) ----
    fm = _mat('glasses', (60, 34, 30), rough=0.3)
    for s in (-1, 1):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.044, minor_radius=0.0052, major_segments=24, minor_segments=6, location=(s*0.066, -0.176, 0.476), rotation=(_R(90), 0, 0))
        o = bpy.context.object; o.data.materials.append(fm); extra.append(o); _bone_parent(o, arm, 'head')
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.0045, depth=0.04, location=(0, -0.178, 0.49), rotation=(0, _R(90), 0))
    o = bpy.context.object; o.data.materials.append(fm); extra.append(o); _bone_parent(o, arm, 'head')
    # ---- pencil through the bun ----
    pen = bpy.data.objects.new('pencil', None); bpy.context.scene.collection.objects.link(pen)
    pen.location = bc + Vector((0, 0.03, 0.07)); pen.rotation_euler = (_R(-18), _R(62), _R(-12))
    def pc(depth, r1, r2, z, mat, verts=6):
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=depth, location=(0, 0, z))
        o = bpy.context.object; o.data.materials.append(mat); o.parent = pen; extra.append(o); return o
    pc(0.27, 0.017, 0.017, 0.0, _mat('pencil_y', (255, 196, 40), rough=0.35))
    pc(0.025, 0.0175, 0.0175, 0.147, _mat('pencil_ferrule', (190, 190, 200), rough=0.25, metal=0.8), verts=12)
    pc(0.035, 0.0172, 0.0172, 0.177, _mat('pencil_eraser', (240, 120, 150), rough=0.6), verts=12)
    pc(0.05, 0.017, 0.004, -0.16, _mat('pencil_wood', (232, 196, 150), rough=0.7))
    pc(0.012, 0.0042, 0.0, -0.191, _mat('pencil_lead', (40, 40, 48), rough=0.4))
    _bone_parent(pen, arm, 'head')
    # ---- headset resting round the neck ----
    gm = _mat('headset', (58, 62, 84), rough=0.35, metal=0.2); led = _mat('headset_led', (80, 230, 255), emit=4.0); rimc = _mat('headset_rim', (90, 110, 150), rough=0.3, metal=0.6)
    hs = bpy.data.objects.new('headset', None); bpy.context.scene.collection.objects.link(hs); hs.location = (0, 0.035, 0.345)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.155, minor_radius=0.016, major_segments=32, minor_segments=8)
    band = bpy.context.object; bm = bmesh.new(); bm.from_mesh(band.data)
    for f in list(bm.faces):
        if f.calc_center_median().y < -0.06: bm.faces.remove(f)
    bm.to_mesh(band.data); bm.free(); band.data.materials.append(gm); band.parent = hs; band.rotation_euler = (_R(-14), 0, 0); extra.append(band)
    for s in (-1, 1):
        cup = bpy.data.objects.new('cup', None); bpy.context.scene.collection.objects.link(cup); cup.parent = hs
        cup.location = (s*0.135, -0.105, -0.04); cup.rotation_euler = (_R(70), 0, _R(s*28))
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.046, depth=0.034); c = bpy.context.object; c.data.materials.append(gm); c.parent = cup; extra.append(c)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.037, minor_radius=0.004, major_segments=24, minor_segments=6, location=(0, 0, 0.018))
        t = bpy.context.object; t.data.materials.append(rimc); t.parent = cup; extra.append(t)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.011, location=(s*0.02, 0.02, 0.022)); dl_ = bpy.context.object; dl_.data.materials.append(led); dl_.parent = cup; extra.append(dl_)
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.04, depth=0.026, location=(0, 0, -0.026))
        p = bpy.context.object; p.data.materials.append(_mat('cushion', (70, 60, 80), rough=0.9)); p.parent = cup; extra.append(p)
    # mic boom
    cu = bpy.data.curves.new('boom', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.007
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(2)
    for bp, p in zip(sp.bezier_points, [(-0.14, -0.13, -0.03), (-0.08, -0.18, -0.07), (0.0, -0.17, -0.11)]): bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'
    bo = bpy.data.objects.new('boom', cu); bpy.context.scene.collection.objects.link(bo); bo.data.materials.append(gm); bo.parent = hs; extra.append(bo)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.017, location=(0.0, -0.17, -0.11)); mic = bpy.context.object; mic.data.materials.append(led); mic.parent = hs; extra.append(mic)
    bpy.context.view_layer.update(); _bone_parent(hs, arm, 'torso')
    # ---- lanyard + badge ----
    lm = _mat('lanyard', (255, 70, 190), rough=0.5)
    for s in (-1, 1):
        cu = bpy.data.curves.new('lan', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.006; cu.extrude = 0.0
        sp = cu.splines.new('BEZIER'); sp.bezier_points.add(2)
        for bp, p in zip(sp.bezier_points, [(s*0.075, -0.115, 0.345), (s*0.05, -0.148, 0.29), (s*0.012, -0.158, 0.245)]): bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'
        o = bpy.data.objects.new('lan', cu); bpy.context.scene.collection.objects.link(o); o.data.materials.append(lm); _bone_parent(o, arm, 'torso'); extra.append(o)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0.0, -0.162, 0.205), rotation=(_R(90), 0, 0))
    bd = bpy.context.object; bd.scale = (0.072, 0.096, 1); bm_, _ = _img_mat('badge', V4+'tex/badge.png', rough=0.3)
    bm_.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 0.0
    bd.data.materials.append(bm_); bd.rotation_euler = (_R(84), 0, _R(-6)); extra.append(bd); _bone_parent(bd, arm, 'torso')
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.166, 0.255)); clip = bpy.context.object; clip.scale = (0.018, 0.008, 0.016)
    clip.data.materials.append(_mat('clip', (80, 230, 255), emit=3.0)); extra.append(clip); _bone_parent(clip, arm, 'torso')
    # ---- v6 readability for side/back views: ears, glasses temple arms, nape + neck, hair tie, thinner side locks ----
    if V6_READ:
        skin = _mat('noor_skin6', C['skin'], rough=0.6)
        for s in (-1, 1):
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.05, segments=16, ring_count=8, location=(s*EAR_X, -0.035, 0.465))
            o = bpy.context.object; o.scale = (0.45, 0.8, 1.0); o.data.materials.append(skin); bpy.ops.object.shade_smooth(); extra.append(o); _bone_parent(o, arm, 'head')
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.016, segments=12, ring_count=6, location=(s*(EAR_X+0.012), -0.03, 0.43))   # tiny stud earring (warm)
            o = bpy.context.object; o.data.materials.append(_mat('stud', (255, 200, 120), rough=0.3, metal=0.8)); extra.append(o); _bone_parent(o, arm, 'head')
            a0 = Vector((s*0.108, -0.176, 0.48)); a1 = Vector((s*(EAR_X-0.005), -0.05, 0.49)); mid = (a0+a1)/2; dv = a1-a0
            bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.0075, depth=dv.length, location=mid)
            o = bpy.context.object; o.rotation_euler = dv.to_track_quat('Z', 'Y').to_euler(); o.data.materials.append(fm); extra.append(o); _bone_parent(o, arm, 'head')
        # nape of the neck (skin) so the back view shows a person, not a hair block
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.062, depth=0.09, location=(0, 0.035, 0.37))
        o = bpy.context.object; o.data.materials.append(skin); bpy.ops.object.shade_smooth(); extra.append(o); _bone_parent(o, arm, 'torso')
        # amber hair tie at the bun base (colour cue for N / NW / NE)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.06, minor_radius=0.014, major_segments=24, minor_segments=6, location=bc + Vector((0, 0.0, 0.0)), rotation=(_R(70), 0, 0))
        o = bpy.context.object; o.data.materials.append(_mat('hairtie', (232, 160, 84), rough=0.4)); extra.append(o); _bone_parent(o, arm, 'head')
    _shrink_head(arm, head, extra)
    arm.data.pose_position = 'POSE'
    root = bpy.data.objects.new(name+'_root', None); bpy.context.scene.collection.objects.link(root)
    arm.parent = root
    meshes = [body, head] + [o for o in extra if o.type in ('MESH', 'CURVE')]
    for o in meshes: o['noor'] = 1
    if holo:
        cache = {}
        def hm_for(m):
            img = None
            if m and m.use_nodes:
                for n in m.node_tree.nodes:
                    if n.type == 'TEX_IMAGE' and n.image: img = n.image
            key = img.name if img else 'plain'
            if key not in cache:
                cache[key] = holo_shader('fern_'+key, hcol, strength=holo.get('strength', 2.4), alpha=holo.get('alpha', 0.6), tex=img,
                                         space=root, dissolve=holo.get('dissolve'), scan=holo.get('scan', 90.0))
            return cache[key]
        for o in meshes:
            if o.type == 'CURVE':
                o.data.materials.clear(); o.data.materials.append(hm_for(None))
            else:
                for sl in o.material_slots: sl.material = hm_for(sl.material)
    return root, arm, meshes

def set_action(arm, key, frame):
    act = bpy.data.actions[arm['actions'][key]]
    arm.animation_data_create(); arm.animation_data.action = act
    bpy.context.scene.frame_set(int(frame)); 
    return act
