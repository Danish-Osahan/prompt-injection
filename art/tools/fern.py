# art-v5 Fern (CALM v5: one slow tier of 6 fragments, soft glow, faint ghost, no magenta shell): the company AI, trained on Noor's replies -> a hologram copy of the new Noor build.
# Layers (inside -> out): textured hologram core (Noor, cyan), magenta ghost copy offset sideways (chromatic glitch),
# two scanline shells (open cylinders), a halo of floating text fragments at two radii, a loading-spinner ring,
# a projector base with a light cone, and glowing white eyes behind the glasses. Original build; needs noor.py loaded.
import bpy, math, bmesh
from mathutils import Vector
_R = math.radians
V4 = '/workspace/games/prompt-injection/art-v5/'

def _glow_mat(name, rgb, strength=2.0, alpha=0.4, tex=None, scan=0.0, space=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL': nt.nodes.remove(n)
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = (*lin(rgb), 1); em.inputs[1].default_value = strength
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
    fac = None
    if tex:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(V4+'tex/'+tex+'.png', check_existing=True)
        fac = t.outputs['Color']
        bw = nt.nodes.new('ShaderNodeRGBToBW'); nt.links.new(fac, bw.inputs[0]); fac = bw.outputs[0]
    if scan:
        tc = nt.nodes.new('ShaderNodeTexCoord'); tc.object = space; sp = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Object'], sp.inputs[0])
        mu = nt.nodes.new('ShaderNodeMath'); mu.operation = 'MULTIPLY'; mu.inputs[1].default_value = scan; nt.links.new(sp.outputs['Z'], mu.inputs[0])
        fr = nt.nodes.new('ShaderNodeMath'); fr.operation = 'FRACT'; nt.links.new(mu.outputs[0], fr.inputs[0])
        gt = nt.nodes.new('ShaderNodeMath'); gt.operation = 'GREATER_THAN'; gt.inputs[1].default_value = 0.86; nt.links.new(fr.outputs[0], gt.inputs[0])
        fac = gt.outputs[0] if fac is None else fac
    a = nt.nodes.new('ShaderNodeMath'); a.operation = 'MULTIPLY'; a.inputs[1].default_value = alpha
    if fac is not None: nt.links.new(fac, a.inputs[0])
    else: a.inputs[0].default_value = 1.0
    nt.links.new(a.outputs[0], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], nt.nodes['Material Output'].inputs[0]); m.blend_method = 'BLEND'
    return m

FERN_FRAGS = [0, 6, 2, 9, 4, 13]   # 'Happy to help!', 'Great question!', 'Warm regards,', 'Hi! I'm Fern :)', ...
# In-engine: orbit the ring SLOWLY (about one turn per 40 s) and fade fragments in/out one at a time.
def build_fern(x=0.0, y=0.0, scale=2.0, index=7, rz=0.0, light=True, action=('idle', 6)):
    CY, MG = (90, 215, 255), (255, 80, 200)
    root, arm, meshes = build_noor('fern', holo=dict(strength=0.8, alpha=0.5, dissolve=(0.02, 0.2), scan=110.0), hcol=CY)
    ghost, garm, gmeshes = build_noor('fern_ghost', holo=dict(strength=0.35, alpha=0.07, dissolve=(0.05, 0.3), scan=60.0), hcol=MG)
    arm.data.pose_position = 'REST'
    top = bpy.data.objects.new('fern_top', None); bpy.context.scene.collection.objects.link(top)
    top.location = (x, y, 0); top.rotation_euler = (0, 0, _R(rz))
    root.parent = top; root.scale = (scale,)*3; root.location = (0, 0, 0.10*scale/2)
    ghost.parent = top; ghost.scale = (scale*1.035,)*3; ghost.location = (0.045*scale/2, 0.02, 0.10*scale/2 + 0.012)
    allobj = list(meshes) + list(gmeshes)
    # glowing eyes behind the glasses (uncanny, always 'on')
    bpy.context.view_layer.update()
    eye = _glow_mat('fern_eye', (230, 250, 255), strength=5.0, alpha=1.0)
    for s in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.022, location=root.matrix_world @ (head_matrix() @ Vector((s*0.066, -0.170, 0.476)))); e = bpy.context.object; e.data.materials.append(eye)
        e.scale = (1.3*scale, 0.5*scale, 0.8*scale); _bone_parent(e, arm, 'head'); allobj.append(e)
    arm.data.pose_position = 'POSE'; set_action(arm, *action); set_action(garm, *action)
    S = scale
    # scanline shells (open-front cylinders) -> volume from every angle
    for r, h, col, sc_, al in ((0.36, 0.86, CY, 9.0, 0.09),):
        bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=r*S/2, depth=h*S/2, end_fill_type='NOTHING', location=(0, 0, h*S/4 + 0.04*S))
        c = bpy.context.object; c.parent = top; c.location = (0, 0, h*S/4 + 0.04*S)
        bm = bmesh.new(); bm.from_mesh(c.data)
        for f in list(bm.faces):
            cc = f.calc_center_median()
            if cc.y < -0.6*r*S/2 and abs(cc.x) < 0.5*r*S/2: bm.faces.remove(f)   # keep the face/front readable
        bm.to_mesh(c.data); bm.free()
        c.data.materials.append(_glow_mat('fern_shell', col, strength=1.4, alpha=al, scan=sc_, space=top)); allobj.append(c)
    # floating text fragments in a halo (two tiers, facing outward so the ring reads from the side too)
    k = 0
    for tier, (rad, zc, n, hh) in enumerate(((0.80, 1.02, 5, 0.10),)):
        for i in range(n):
            a = 2*math.pi*i/n + tier*0.31
            fi = FERN_FRAGS[k % len(FERN_FRAGS)]; img = bpy.data.images.load(V4+'tex/frag%d.png' % fi, check_existing=True); ar = img.size[0]/img.size[1]
            bpy.ops.mesh.primitive_plane_add(size=1); p = bpy.context.object
            p.scale = (hh*S*ar/2, hh*S/2, 1); p.parent = top
            p.location = (math.sin(a)*rad*S/2*1.35, -math.cos(a)*rad*S/2*1.35, zc*S/2 + 0.035*math.sin(2*a)*S)
            p.rotation_euler = (_R(90), 0, 0)   # v5: billboard to the camera (no edge-on slivers)
            p.data.materials.append(_glow_mat('frag%d' % k, (150, 225, 240), strength=1.3, alpha=0.8, tex='frag%d' % fi))
            allobj.append(p); k += 1
    # loading-spinner ring behind the head
    bpy.ops.mesh.primitive_torus_add(major_radius=0.30*S, minor_radius=0.008*S, major_segments=64, minor_segments=8, rotation=(_R(90), 0, 0))
    t = bpy.context.object; bm = bmesh.new(); bm.from_mesh(t.data)
    for f in list(bm.faces):
        c = f.calc_center_median()
        if c.x > 0.08*S and c.z > 0.08*S: bm.faces.remove(f)
    bm.to_mesh(t.data); bm.free(); t.parent = top; t.location = (0, 0.20*S, 0.66*S)
    t.data.materials.append(_glow_mat('fern_ring', (240, 160, 214), strength=1.0, alpha=0.55)); allobj.append(t)
    # projector base: dark puck with emissive rings + light cone
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.30*S, depth=0.05, location=(0, 0, 0.025)); b = bpy.context.object; b.parent = top; b.location = (0, 0, 0.025)
    b.data.materials.append(_mat('fern_base', (20, 22, 40), rough=0.3, metal=0.5)); allobj.append(b)
    for rr in (0.29, 0.18):
        bpy.ops.mesh.primitive_torus_add(major_radius=rr*S, minor_radius=0.006*S, major_segments=48, minor_segments=6); tt = bpy.context.object
        tt.parent = top; tt.location = (0, 0, 0.052); tt.data.materials.append(_glow_mat('fern_ring2', CY, strength=2.2, alpha=0.9)); allobj.append(tt)
    bpy.ops.mesh.primitive_cone_add(vertices=40, radius1=0.30*S, radius2=0.42*S, depth=0.95*S, end_fill_type='NOTHING'); cn = bpy.context.object
    cn.parent = top; cn.location = (0, 0, 0.95*S/2 + 0.05); cn.data.materials.append(_glow_mat('fern_cone', CY, strength=0.8, alpha=0.035, scan=5.0, space=top)); allobj.append(cn)
    for o in allobj: o.pass_index = index
    if light:
        for (lx, ly, lz, e, c) in ((0, -0.5*S, 0.6*S, 14*S, (0.35, 0.75, 0.95)), (0, 0, 0.1, 6*S, (0.35, 0.8, 0.95))):
            ld = bpy.data.lights.new('fernL', 'POINT'); ld.energy = e; ld.color = c; ld.shadow_soft_size = 0.3
            lo = bpy.data.objects.new('fernL', ld); bpy.context.scene.collection.objects.link(lo); lo.parent = top; lo.location = (lx, ly, lz)
    top['objs'] = len(allobj)
    return top
