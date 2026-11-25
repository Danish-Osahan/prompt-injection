# art-v12d: deep perspective pitfall for the hub rift.
# Rims land 1:1 on game coords (x 80..1200, ny 248, sy 404). Shaft walls extrude along perspective rays
# toward a deep vanishing throat V = unproj(640, 392, -6.4).
# Uses vertex-guided depth/overhang falloff + Cycles concrete noise + directional lighting so:
#   - north cliff & both broken lips catch cool room light (readable thickness + rim)
#   - steep converging side walls + vertical north pilasters show strong pitfall depth
#   - brightness and detail vanish rapidly into cold slate fog, then near-black abyss.
import bpy, bmesh, math, random, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
OUT = argv[0]; SAMPLES = int(argv[1]) if len(argv) > 1 else 64
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; R = math.radians; random.seed(37)

O7 = 8.4; T7 = R(90 - 38); Y7 = R(30)
RIGHT = Vector((math.cos(Y7), math.sin(Y7), 0))
UP = Vector((-math.sin(Y7)*math.cos(T7), math.cos(Y7)*math.cos(T7), math.sin(T7)))
def unproj(sx, sy, z=0.0):
    u = (sx - 640)*O7/1280; v = (360 - sy)*O7/1280; dz = z - 0.5
    a, b, c, d = RIGHT.x, RIGHT.y, UP.x, UP.y; r1 = u - RIGHT.z*dz; r2 = v - UP.z*dz; det = a*d - b*c
    return Vector(((r1*d - b*r2)/det, (a*r2 - c*r1)/det, z))

cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = O7; cd.clip_end = 100
cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
t = R(90 - 38); yw = R(-30); dirv = Vector((math.sin(yw)*math.sin(t), math.cos(yw)*math.sin(t), -math.cos(t)))
cam.location = Vector((0, 0, 0.5)) - dirv*20; cam.rotation_euler = (t, 0, -yw)

X0, X1, NY, SY = 80, 1200, 248, 404
LANE0, LANE1 = 592, 688
DEPTH = 6.4
V = unproj(640, 392, -DEPTH)
N = (unproj(640, 300) - unproj(640, 310)).normalized()
E = (unproj(650, 300) - unproj(640, 300)).normalized()

def P(sx, sy, k=0.0, off=Vector((0, 0, 0))):
    return unproj(sx, sy, 0.0).lerp(V, k) + off

def L3(c): return tuple(((v/255) ** 2.2) for v in c)

def pit_mat(name, rgb, rough=0.92, metal=0.03, noise=0.38, fog_end=-2.4, emit=None, use_vcol=True):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; ns = nt.nodes; L = nt.links
    bs = ns['Principled BSDF']; bs.inputs['Roughness'].default_value = rough; bs.inputs['Metallic'].default_value = metal
    if 'Specular IOR Level' in bs.inputs: bs.inputs['Specular IOR Level'].default_value = 0.0
    tc = ns.new('ShaderNodeTexCoord'); nz = ns.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 9.0; nz.inputs['Detail'].default_value = 7; nz.inputs['Roughness'].default_value = 0.65
    L.new(tc.outputs['Object'], nz.inputs['Vector'])
    mix = ns.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    mix.inputs['A'].default_value = (*[v*(1 - noise) for v in L3(rgb)], 1)
    mix.inputs['B'].default_value = (*L3(rgb), 1)
    L.new(nz.outputs['Fac'], mix.inputs['Factor'])
    if use_vcol:
        vc = ns.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
        mul = ns.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs['Factor'].default_value = 1.0
        L.new(mix.outputs['Result'], mul.inputs['A']); L.new(vc.outputs['Color'], mul.inputs['B'])
        L.new(mul.outputs['Result'], bs.inputs['Base Color'])
    else:
        L.new(mix.outputs['Result'], bs.inputs['Base Color'])
    if emit:
        bs.inputs['Emission Color'].default_value = (*L3(emit[0]), 1)
        bs.inputs['Emission Strength'].default_value = emit[1]
    geo = ns.new('ShaderNodeNewGeometry'); sep = ns.new('ShaderNodeSeparateXYZ'); L.new(geo.outputs['Position'], sep.inputs['Vector'])
    mr1 = ns.new('ShaderNodeMapRange'); mr1.inputs['From Min'].default_value = -0.05; mr1.inputs['From Max'].default_value = fog_end * 0.55
    mr1.inputs['To Min'].default_value = 0.0; mr1.inputs['To Max'].default_value = 1.0; L.new(sep.outputs['Z'], mr1.inputs['Value'])
    pw1 = ns.new('ShaderNodeMath'); pw1.operation = 'POWER'; pw1.inputs[1].default_value = 0.65; L.new(mr1.outputs['Result'], pw1.inputs[0])
    fog_em = ns.new('ShaderNodeEmission'); fog_em.inputs['Color'].default_value = (*L3((7, 16, 26)), 1); fog_em.inputs['Strength'].default_value = 1.0
    ms1 = ns.new('ShaderNodeMixShader'); L.new(pw1.outputs['Value'], ms1.inputs['Fac']); L.new(bs.outputs['BSDF'], ms1.inputs[1]); L.new(fog_em.outputs['Emission'], ms1.inputs[2])
    mr2 = ns.new('ShaderNodeMapRange'); mr2.inputs['From Min'].default_value = fog_end * 0.42; mr2.inputs['From Max'].default_value = fog_end
    mr2.inputs['To Min'].default_value = 0.0; mr2.inputs['To Max'].default_value = 1.0; L.new(sep.outputs['Z'], mr2.inputs['Value'])
    blk_em = ns.new('ShaderNodeEmission'); blk_em.inputs['Color'].default_value = (*L3((1, 2, 3)), 1); blk_em.inputs['Strength'].default_value = 1.0
    ms2 = ns.new('ShaderNodeMixShader'); L.new(mr2.outputs['Result'], ms2.inputs['Fac']); L.new(ms1.outputs['Shader'], ms2.inputs[1]); L.new(blk_em.outputs['Emission'], ms2.inputs[2])
    L.new(ms2.outputs['Shader'], ns['Material Output'].inputs['Surface']); return m

def mesh_strips(name, rows_pts, rows_col, mat):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    col_lay = bm.loops.layers.color.new('Col')
    grid = [[bm.verts.new(p) for p in r] for r in rows_pts]
    for i in range(len(grid) - 1):
        for j in range(len(grid[i]) - 1):
            f = bm.faces.new([grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]])
            cs = [rows_col[i][j], rows_col[i][j + 1], rows_col[i + 1][j + 1], rows_col[i + 1][j]]
            for lp, c in zip(f.loops, cs): lp[col_lay] = (c, c, c, 1.0)
    bm.normal_update(); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); o.data.materials.append(mat); return o

def box_pts(name, pts_list, mat, cols=(1.0, 1.0)):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    col_lay = bm.loops.layers.color.new('Col')
    a = [bm.verts.new(p) for p in pts_list[0]]; b = [bm.verts.new(p) for p in pts_list[1]]
    fa = bm.faces.new(a); fb = bm.faces.new(list(reversed(b)))
    for lp in fa.loops: lp[col_lay] = (cols[0], cols[0], cols[0], 1.0)
    for lp in fb.loops: lp[col_lay] = (cols[1], cols[1], cols[1], 1.0)
    for i in range(4):
        j = (i + 1) % 4; f = bm.faces.new([a[i], a[j], b[j], b[i]])
        for k, lp in enumerate(f.loops):
            c = cols[0] if k < 2 else cols[1]; lp[col_lay] = (c, c, c, 1.0)
    bm.normal_update(); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); o.data.materials.append(mat); return o

wall_n = pit_mat('wall_n', (124, 142, 160), rough=0.95, noise=0.38, fog_end=-3.1, emit=((16, 30, 44), 0.14))
wall_side = pit_mat('wall_side', (88, 104, 120), rough=0.94, noise=0.35, fog_end=-2.1)
lip_face = pit_mat('lip_face', (126, 142, 158), rough=0.86, noise=0.38, fog_end=-1.5, emit=((26, 46, 62), 0.16))
pilaster_m = pit_mat('pilaster', (112, 130, 148), rough=0.94, noise=0.34, fog_end=-2.9, emit=((14, 26, 38), 0.12))
south_mat = pit_mat('south_mat', (58, 74, 88), rough=0.84, noise=0.30, emit=((24, 46, 62), 0.12), use_vcol=False)
rebar_m = pit_mat('rebar', (86, 56, 44), rough=0.65, metal=0.6, fog_end=-1.7, use_vcol=False)
rim_edge = pit_mat('rim_edge', (110, 174, 190), rough=0.5, emit=((95, 168, 184), 0.38), fog_end=-0.45, use_vcol=False)

void_black = bpy.data.materials.new('void_black'); void_black.use_nodes = True
vb_ns = void_black.node_tree.nodes; vb_ns.remove(vb_ns['Principled BSDF'])
vb_em = vb_ns.new('ShaderNodeEmission'); vb_em.inputs['Color'].default_value = (0, 0, 0, 1)
void_black.node_tree.links.new(vb_em.outputs[0], vb_ns['Material Output'].inputs['Surface'])

PIT_OBJS = []; SOUTH_OBJS = []

# 0. Black abyss backing
me_ab = bpy.data.meshes.new('abyss'); bm_ab = bmesh.new()
bm_ab.faces.new([bm_ab.verts.new(unproj(sx, sy, 0) + Vector((0, 0, -6.0))) for sx, sy in ((X0, NY), (X1, NY), (X1, SY), (X0, SY))])
bm_ab.to_mesh(me_ab); bm_ab.free(); o_ab = bpy.data.objects.new('abyss', me_ab); sc.collection.objects.link(o_ab); o_ab.data.materials.append(void_black); PIT_OBJS.append(o_ab)

me_th = bpy.data.meshes.new('throat'); bm_th = bmesh.new()
bm_th.faces.new([bm_th.verts.new(P(sx, sy, 0.78)) for sx, sy in ((X0, NY), (X1, NY), (X1, SY), (X0, SY))])
bm_th.to_mesh(me_th); bm_th.free(); o_th = bpy.data.objects.new('throat', me_th); sc.collection.objects.link(o_th); o_th.data.materials.append(void_black); PIT_OBJS.append(o_th)

# 1. Receding shaft walls (North, West, East)
ks = [0.0, 0.05, 0.12, 0.22, 0.35, 0.50, 0.68, 0.80]
k_shade = lambda k: max(0.0, (1.0 - min(1.0, k / 0.62)) ** 1.65)
n_xs = [X0 + (X1 - X0) * i / 36 for i in range(37)]
rows_n, cols_n = [], []
for k in ks:
    row, crow = [], []
    for x in n_xs:
        in_lane = (LANE0 - 6 <= x <= LANE1 + 6)
        jitter = (random.uniform(-0.035, 0.035) if (k > 0 and X0 < x < X1) else 0.0) * (1 - k * 0.75)
        if in_lane and k < 0.22: jitter -= 0.03
        row.append(P(x, NY, k, N * jitter))
        # Subtle edge vignette near corners
        corner = 1.0 - 0.35 * ((abs(x - 640) / 560.0) ** 2)
        crow.append(k_shade(k) * corner)
    rows_n.append(row); cols_n.append(crow)
PIT_OBJS.append(mesh_strips('wall_north', rows_n, cols_n, wall_n))

s_ys = [NY + (SY - NY) * i / 12 for i in range(13)]
rows_w, cols_w, rows_e, cols_e = [], [], [], []
for k in ks:
    rw, cw, re_, ce = [], [], [], []
    for iy, y in enumerate(s_ys):
        yt = (y - NY) / (SY - NY)
        # Steep shadow near south overhang (yt -> 1) so bottom-left/right corners stay dark pit!
        sh = k_shade(k) * max(0.05, (1.0 - yt * 0.88))
        rw.append(P(X0, y, k, E * (random.uniform(-0.015, 0.015) if (k > 0 and 0 < iy < len(s_ys)-1) else 0))); cw.append(sh)
        re_.append(P(X1, y, k, -E * (random.uniform(-0.015, 0.015) if (k > 0 and 0 < iy < len(s_ys)-1) else 0))); ce.append(sh)
    rows_w.append(rw); cols_w.append(cw); rows_e.append(re_); cols_e.append(ce)
PIT_OBJS.append(mesh_strips('wall_west', rows_w, cols_w, wall_side))
PIT_OBJS.append(mesh_strips('wall_east', rows_e, cols_e, wall_side))

# 2. Perspective-converging vertical concrete pilasters down the far North wall
for px in (128, 256, 384, 512, 588, 692, 768, 896, 1024, 1152):
    pw = 9.5 if px in (588, 692) else 7.5
    top_q = [P(px - pw, NY, 0.025, -N * 0.045), P(px + pw, NY, 0.025, -N * 0.045), P(px + pw, NY, 0.025, N * 0.03), P(px - pw, NY, 0.025, N * 0.03)]
    bot_q = [P(px - pw, NY, 0.65, -N * 0.01), P(px + pw, NY, 0.65, -N * 0.01), P(px + pw, NY, 0.65, N * 0.015), P(px - pw, NY, 0.65, N * 0.015)]
    PIT_OBJS.append(box_pts('pil_n', [top_q, bot_q], pilaster_m, (0.95, 0.0)))

# 2b. Side wall converging ribs (strongest near upper-north, vanishing toward south & depth)
for py in (274, 306):
    ph = 4.5
    yt = (py - NY) / (SY - NY)
    sh = max(0.15, 1.0 - yt * 0.85)
    tq_w = [P(X0, py - ph, 0.02, E * 0.025), P(X0, py + ph, 0.02, E * 0.025), P(X0, py + ph, 0.02, -E * 0.02), P(X0, py - ph, 0.02, -E * 0.02)]
    bq_w = [P(X0, py - ph, 0.60, E * 0.008), P(X0, py + ph, 0.60, E * 0.008), P(X0, py + ph, 0.60, -E * 0.008), P(X0, py - ph, 0.60, -E * 0.008)]
    PIT_OBJS.append(box_pts('pil_w', [tq_w, bq_w], wall_side, (sh, 0.0)))
    tq_e = [P(X1, py - ph, 0.02, -E * 0.025), P(X1, py + ph, 0.02, -E * 0.025), P(X1, py + ph, 0.02, E * 0.02), P(X1, py - ph, 0.02, E * 0.02)]
    bq_e = [P(X1, py - ph, 0.60, -E * 0.008), P(X1, py + ph, 0.60, -E * 0.008), P(X1, py + ph, 0.60, E * 0.008), P(X1, py - ph, 0.60, E * 0.008)]
    PIT_OBJS.append(box_pts('pil_e', [tq_e, bq_e], wall_side, (sh, 0.0)))

# 3. North (far) broken slab edge + subtle rim + sparse rebar
x = X0
while x < X1:
    seg_w = min(random.uniform(36, 86), X1 - x)
    in_lane = (x + seg_w > LANE0 + 6 and x < LANE1 - 6)
    if not in_lane:
        k_bot = random.uniform(0.06, 0.092)
        jut = random.uniform(0.012, 0.055)
        t_q = [P(x, NY, 0.0, N * 0.04), P(x + seg_w + 1, NY, 0.0, N * 0.04), P(x + seg_w + 1, NY, 0.0, -N * jut), P(x, NY, 0.0, -N * jut)]
        b_q = [P(x, NY, k_bot, N * 0.04), P(x + seg_w + 1, NY, k_bot, N * 0.04), P(x + seg_w + 1, NY, k_bot, -N * (jut * 0.5)), P(x, NY, k_bot, -N * (jut * 0.5))]
        PIT_OBJS.append(box_pts('nlip', [t_q, b_q], lip_face, (1.0, 0.72)))
        c0 = [P(x, NY, 0.0, -N * (jut * 0.4)), P(x + seg_w, NY, 0.0, -N * (jut * 0.4)), P(x + seg_w, NY, 0.0, -N * (jut + 0.007)), P(x, NY, 0.0, -N * (jut + 0.007))]
        c1 = [P(x, NY, 0.008, -N * (jut * 0.4)), P(x + seg_w, NY, 0.008, -N * (jut * 0.4)), P(x + seg_w, NY, 0.008, -N * (jut + 0.007)), P(x, NY, 0.008, -N * (jut + 0.007))]
        PIT_OBJS.append(box_pts('ncyan', [c0, c1], rim_edge))
        if random.random() < 0.45:
            rx = x + seg_w * random.uniform(0.25, 0.75); ln = random.uniform(0.06, 0.14)
            loc = P(rx, NY, k_bot * 0.7, -N * (jut * 0.5)) + Vector((0, 0, -ln * 0.4))
            bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.0045, depth=ln, location=loc,
                rotation=(R(random.uniform(-22, 16)), R(random.uniform(-18, 18)), 0))
            o = bpy.context.object; o.data.materials.append(rebar_m); PIT_OBJS.append(o)
    x += seg_w

# 4. Sparse, scale-graded debris (5 pieces) + 3 hanging cables
debris_m = pit_mat('debris', (136, 154, 170), rough=0.88, noise=0.32, fog_end=-2.0, emit=((28, 48, 66), 0.18), use_vcol=False)
for sx, sy, dk, sz in ((225, NY, 0.09, 0.095), (855, NY, 0.12, 0.082), (420, NY, 0.21, 0.055), (1010, NY, 0.25, 0.045), (735, NY, 0.36, 0.028)):
    loc = P(sx, sy, dk, -N * 0.03)
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object; o.scale = (sz * 1.4, sz * 0.8, sz * 0.35)
    o.rotation_euler = (random.uniform(-0.5, 0.5), random.uniform(-0.4, 0.4), random.uniform(0, 3.14))
    o.data.materials.append(debris_m); PIT_OBJS.append(o)

for cx in (176, 462, 956):
    ln = random.uniform(0.55, 0.85)
    top_p = P(cx, NY, 0.05, -N * 0.025)
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.004, depth=ln, location=top_p + Vector((0, 0, -ln / 2)),
        rotation=(R(random.uniform(-4, 4)), R(random.uniform(-5, 5)), 0))
    o = bpy.context.object; o.data.materials.append(rebar_m); PIT_OBJS.append(o)

# 5. Near (South) broken lip (separate pass)
x = X0
while x < X1:
    seg_w = min(random.uniform(28, 70), X1 - x)
    in_lane = (x + seg_w > LANE0 + 4 and x < LANE1 - 4)
    if not in_lane:
        jut = random.uniform(0.012, 0.048)
        p_front = unproj(x, SY + 1, 0.0); p_front2 = unproj(x + seg_w + 1, SY + 1, 0.0)
        p_back = unproj(x, SY, 0.0) + N * jut; p_back2 = unproj(x + seg_w + 1, SY, 0.0) + N * jut
        top_q = [p_front, p_front2, p_back2, p_back]
        bot_q = [q + Vector((0, 0, -0.07)) for q in top_q]
        SOUTH_OBJS.append(box_pts('south_lip', [top_q, bot_q], south_mat))
        rim0 = [p_back - N * 0.008 + Vector((0, 0, 0.004)), p_back2 - N * 0.008 + Vector((0, 0, 0.004)),
                p_back2 + Vector((0, 0, 0.004)), p_back + Vector((0, 0, 0.004))]
        rim1 = [q + Vector((0, 0, -0.012)) for q in rim0]
        SOUTH_OBJS.append(box_pts('south_rim', [rim0, rim1], rim_edge))
    x += seg_w

# 6. Lights using exact look_at quaternions
def light_aim(kind, loc, target, energy, col, size=1.0):
    ld = bpy.data.lights.new(kind, kind); ld.energy = energy; ld.color = col
    if kind == 'AREA': ld.size = size
    o = bpy.data.objects.new(kind, ld); sc.collection.objects.link(o); o.location = loc
    d = (Vector(target) - Vector(loc)).normalized()
    o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return o

# Main cool room light aimed directly onto the upper North cliff wall & its pilasters
light_aim('AREA', unproj(640, 480, 2.2), unproj(640, 260, -0.35), 420, (0.72, 0.88, 1.0), size=9.0)
# Slight angled fill from left-front so pilasters cast clear 3D side relief
light_aim('SUN', (0, 0, 5), (-0.45, 0.85, -0.75), 1.4, (0.74, 0.88, 1.0))
# Gentle rim on the near south lip
light_aim('AREA', unproj(640, 260, 1.3), unproj(640, 404, 0.0), 38, (0.72, 0.88, 1.0), size=8.0)

sw = bpy.data.worlds.new('w'); sc.world = sw; sw.use_nodes = True
sw.node_tree.nodes['Background'].inputs['Color'].default_value = (0.001, 0.002, 0.004, 1)

sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
sc.render.resolution_x = 1280; sc.render.resolution_y = 720; sc.render.film_transparent = True
sc.view_settings.view_transform = 'Standard'; sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'

for o in SOUTH_OBJS: o.hide_render = True
for o in PIT_OBJS: o.hide_render = False
sc.render.use_border = True; sc.render.use_crop_to_border = False
sc.render.border_min_x = 0; sc.render.border_max_x = 1
sc.render.border_min_y = 1 - 418/720; sc.render.border_max_y = 1 - 236/720
sc.render.filepath = os.path.join(OUT, 'hub_rift.png'); bpy.ops.render.render(write_still=True)

for o in PIT_OBJS: o.hide_render = True
for o in SOUTH_OBJS: o.hide_render = False
sc.render.border_min_y = 1 - 418/720; sc.render.border_max_y = 1 - 384/720
sc.render.filepath = os.path.join(OUT, 'hub_rift_south.png'); bpy.ops.render.render(write_still=True)
