# art-v12e: hub rift with visible far cliff wall & fractured rock/broken-floor strata across the full width.
# Camera matches room ortho (O7=8.4, pitch 38, yaw -30); rim lands 1:1 on (x 80..1200, ny 248, sy 404).
# Shaft walls extrude toward vanishing point V = unproj(640, 392, -6.4).
# Key improvements:
#   - Far (north) cliff wall carries irregular fractured rock/concrete strata & vertical fissures all the way down
#     into the middle span (k 0.0 -> 0.76, y 248 -> 364), lit from above so top bevels catch light while
#     undercuts drop into shadow, fading smoothly through cold chasm fog into near-black at the bottom.
#   - Side walls converge steeply inward and darken quickly under the south overhang.
import bpy, bmesh, math, random, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
OUT = argv[0]; SAMPLES = int(argv[1]) if len(argv) > 1 else 64
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; R = math.radians; random.seed(42)

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

def pit_mat(name, rgb, rough=0.93, metal=0.02, noise=0.40, fog_start=-0.25, fog_mid=-2.6, fog_end=-4.7, emit=None, use_vcol=True, fog_col=(13, 27, 41)):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; ns = nt.nodes; L = nt.links
    bs = ns['Principled BSDF']; bs.inputs['Roughness'].default_value = rough; bs.inputs['Metallic'].default_value = metal
    if 'Specular IOR Level' in bs.inputs: bs.inputs['Specular IOR Level'].default_value = 0.0
    tc = ns.new('ShaderNodeTexCoord'); nz = ns.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 10.5; nz.inputs['Detail'].default_value = 8; nz.inputs['Roughness'].default_value = 0.68
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
    # Stage 1: upper lit cliff -> cold blue-slate depth fog
    mr1 = ns.new('ShaderNodeMapRange'); mr1.inputs['From Min'].default_value = fog_start; mr1.inputs['From Max'].default_value = fog_mid
    mr1.inputs['To Min'].default_value = 0.0; mr1.inputs['To Max'].default_value = 1.0; L.new(sep.outputs['Z'], mr1.inputs['Value'])
    pw1 = ns.new('ShaderNodeMath'); pw1.operation = 'POWER'; pw1.inputs[1].default_value = 0.85; L.new(mr1.outputs['Result'], pw1.inputs[0])
    fog_em = ns.new('ShaderNodeEmission'); fog_em.inputs['Color'].default_value = (*L3(fog_col), 1); fog_em.inputs['Strength'].default_value = 1.0
    ms1 = ns.new('ShaderNodeMixShader'); L.new(pw1.outputs['Value'], ms1.inputs['Fac']); L.new(bs.outputs['BSDF'], ms1.inputs[1]); L.new(fog_em.outputs['Emission'], ms1.inputs[2])
    # Stage 2: cold fog -> near-black bottom
    mr2 = ns.new('ShaderNodeMapRange'); mr2.inputs['From Min'].default_value = fog_mid * 0.72; mr2.inputs['From Max'].default_value = fog_end
    mr2.inputs['To Min'].default_value = 0.0; mr2.inputs['To Max'].default_value = 1.0; L.new(sep.outputs['Z'], mr2.inputs['Value'])
    blk_em = ns.new('ShaderNodeEmission'); blk_em.inputs['Color'].default_value = (*L3((1, 2, 4)), 1); blk_em.inputs['Strength'].default_value = 1.0
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

# Materials: far cliff fades gradually so mid-pit strata stay readable in cold fog before turning black at the bottom
wall_n = pit_mat('wall_n', (96, 114, 132), rough=0.95, noise=0.45, fog_start=-0.30, fog_mid=-3.2, fog_end=-5.2, emit=((10, 22, 34), 0.07))
strata_m = pit_mat('strata', (106, 124, 140), rough=0.92, noise=0.42, fog_start=-0.25, fog_mid=-3.1, fog_end=-5.0, emit=((12, 24, 36), 0.06))
wall_side = pit_mat('wall_side', (66, 82, 98), rough=0.94, noise=0.35, fog_start=-0.05, fog_mid=-0.75, fog_end=-1.45, fog_col=(4, 9, 15))
lip_face = pit_mat('lip_face', (128, 146, 162), rough=0.86, noise=0.38, fog_start=-0.10, fog_mid=-1.5, fog_end=-2.5, emit=((24, 44, 60), 0.16))
pilaster_m = pit_mat('pilaster', (96, 114, 132), rough=0.92, noise=0.36, fog_start=-0.30, fog_mid=-2.9, fog_end=-4.8, emit=((10, 20, 30), 0.08))
south_mat = pit_mat('south_mat', (58, 74, 88), rough=0.84, noise=0.30, emit=((24, 46, 62), 0.12), use_vcol=False)
rebar_m = pit_mat('rebar', (86, 56, 44), rough=0.65, metal=0.6, fog_mid=-1.6, fog_end=-2.8, use_vcol=False)
rim_edge = pit_mat('rim_edge', (110, 174, 190), rough=0.5, emit=((95, 168, 184), 0.38), fog_mid=-0.45, fog_end=-0.9, use_vcol=False)

void_black = bpy.data.materials.new('void_black'); void_black.use_nodes = True
vb_ns = void_black.node_tree.nodes; vb_ns.remove(vb_ns['Principled BSDF'])
vb_em = vb_ns.new('ShaderNodeEmission'); vb_em.inputs['Color'].default_value = (0, 0, 0, 1)
void_black.node_tree.links.new(vb_em.outputs[0], vb_ns['Material Output'].inputs['Surface'])

PIT_OBJS = []; SOUTH_OBJS = []

# 0. Black abyss backing
me_ab = bpy.data.meshes.new('abyss'); bm_ab = bmesh.new()
bm_ab.faces.new([bm_ab.verts.new(unproj(sx, sy, 0) + Vector((0, 0, -6.2))) for sx, sy in ((X0, NY), (X1, NY), (X1, SY), (X0, SY))])
bm_ab.to_mesh(me_ab); bm_ab.free(); o_ab = bpy.data.objects.new('abyss', me_ab); sc.collection.objects.link(o_ab); o_ab.data.materials.append(void_black); PIT_OBJS.append(o_ab)

me_th = bpy.data.meshes.new('throat'); bm_th = bmesh.new()
bm_th.faces.new([bm_th.verts.new(P(sx, sy, 0.80)) for sx, sy in ((X0, NY), (X1, NY), (X1, SY), (X0, SY))])
bm_th.to_mesh(me_th); bm_th.free(); o_th = bpy.data.objects.new('throat', me_th); sc.collection.objects.link(o_th); o_th.data.materials.append(void_black); PIT_OBJS.append(o_th)

# 1. Receding North cliff backing + West/East converging walls (corners exact at X0/X1 so no gaps)
ks = [0.0, 0.06, 0.14, 0.24, 0.36, 0.50, 0.64, 0.78, 0.86]
k_shade_n = lambda k: max(0.0, (1.0 - min(1.0, k / 0.82)) ** 1.35)
k_shade_s = lambda k: max(0.0, (1.0 - min(1.0, k / 0.46)) ** 1.8)
n_xs = [X0 + (X1 - X0) * i / 48 for i in range(49)]
rows_n, cols_n = [], []
for k in ks:
    row, crow = [], []
    for x in n_xs:
        in_lane = (LANE0 - 6 <= x <= LANE1 + 6)
        # Displace the cliff face organically in depth so it reads as rough bedrock/concrete, not a flat plane
        wave = 0.055 * math.sin(x * 0.021 + k * 7.0) + 0.035 * math.cos(x * 0.047 - k * 4.0)
        jitter = ((wave + random.uniform(-0.025, 0.025)) if (k > 0 and X0 < x < X1) else 0.0) * (1 - k * 0.6)
        if in_lane and k < 0.25: jitter -= 0.025
        row.append(P(x, NY, k, N * jitter))
        # Subtle lift in the middle span so the receding cliff reads across the whole rift, darker at the corners
        corner = 1.0 - 0.28 * ((abs(x - 640) / 560.0) ** 2)
        crow.append(k_shade_n(k) * corner)
    rows_n.append(row); cols_n.append(crow)
PIT_OBJS.append(mesh_strips('wall_north', rows_n, cols_n, wall_n))

s_ys = [NY + (SY - NY) * i / 12 for i in range(13)]
rows_w, cols_w, rows_e, cols_e = [], [], [], []
for k in ks:
    rw, cw, re_, ce = [], [], [], []
    for iy, y in enumerate(s_ys):
        yt = (y - NY) / (SY - NY)
        sh = k_shade_s(k) * max(0.02, (1.0 - yt * 0.95))
        rw.append(P(X0, y, k, E * (random.uniform(-0.015, 0.015) if (k > 0 and 0 < iy < len(s_ys) - 1) else 0))); cw.append(sh)
        re_.append(P(X1, y, k, -E * (random.uniform(-0.015, 0.015) if (k > 0 and 0 < iy < len(s_ys) - 1) else 0))); ce.append(sh)
    rows_w.append(rw); cols_w.append(cw); rows_e.append(re_); cols_e.append(ce)
PIT_OBJS.append(mesh_strips('wall_west', rows_w, cols_w, wall_side))
PIT_OBJS.append(mesh_strips('wall_east', rows_e, cols_e, wall_side))

# 2. Fractured rock / broken-floor strata across the ENTIRE far cliff (especially the middle!)
#    Each stratum is a broken series of protruding angled ledges (top face catches overhead light,
#    underside drops into shadow) following perspective toward V, getting thinner and dimmer with depth.
strata_defs = [
    # (k_top, k_bot, protrusion_min, protrusion_max, gap_chance, vcol)
    (0.075, 0.118, 0.055, 0.125, 0.14, 0.92),
    (0.145, 0.195, 0.045, 0.110, 0.18, 0.78),
    (0.225, 0.278, 0.038, 0.095, 0.20, 0.62),
    (0.320, 0.372, 0.030, 0.080, 0.22, 0.46),
    (0.430, 0.482, 0.022, 0.062, 0.24, 0.31),
    (0.555, 0.605, 0.016, 0.045, 0.26, 0.18),
]
for idx, (kt, kb, pmin, pmax, gch, vc) in enumerate(strata_defs):
    x = X0 + 2.0
    while x < X1 - 2.0:
        w = min(random.uniform(38, 92), (X1 - 2.0) - x)
        if random.random() < gch:
            x += w * 0.65; continue
        # Vary top/bottom k slightly per broken rock block so strata never look like uniform shelves
        kt_l = max(0.04, kt + random.uniform(-0.014, 0.014))
        kt_r = max(0.04, kt + random.uniform(-0.014, 0.014))
        kb_l = min(0.75, kb + random.uniform(-0.012, 0.014))
        kb_r = min(0.75, kb + random.uniform(-0.012, 0.014))
        jut_l = random.uniform(pmin, pmax); jut_r = random.uniform(pmin, pmax)
        # Top quad slopes slightly forward/down to catch overhead light; bottom quad tucks back into cliff
        top_q = [
            P(x, NY, kt_l, N * 0.04),
            P(x + w, NY, kt_r, N * 0.04),
            P(x + w, NY, kt_r + 0.012, -N * jut_r),
            P(x, NY, kt_l + 0.012, -N * jut_l),
        ]
        bot_q = [
            P(x, NY, kb_l, N * 0.04),
            P(x + w, NY, kb_r, N * 0.04),
            P(x + w, NY, kb_r, -N * (jut_r * 0.35)),
            P(x, NY, kb_l, -N * (jut_l * 0.35)),
        ]
        PIT_OBJS.append(box_pts(f'stratum_{idx}', [top_q, bot_q], strata_m, (vc, vc * 0.55)))
        x += w + random.uniform(4, 16)

# 3. Perspective-converging vertical fracture ribs / concrete pilasters down the far cliff (including center!)
for px in (128, 240, 356, 472, 560, 640, 720, 812, 924, 1040, 1152):
    pw = 8.5 if px in (560, 720) else (6.5 if px == 640 else 7.5)
    top_q = [P(px - pw, NY, 0.03, -N * 0.05), P(px + pw, NY, 0.03, -N * 0.05), P(px + pw, NY, 0.03, N * 0.03), P(px - pw, NY, 0.03, N * 0.03)]
    bot_q = [P(px - pw, NY, 0.72, -N * 0.01), P(px + pw, NY, 0.72, -N * 0.01), P(px + pw, NY, 0.72, N * 0.015), P(px - pw, NY, 0.72, N * 0.015)]
    PIT_OBJS.append(box_pts('pil_n', [top_q, bot_q], pilaster_m, (0.90, 0.05)))

# Side wall converging ribs
for py in (274, 306):
    ph = 4.5; yt = (py - NY) / (SY - NY); sh = max(0.12, 1.0 - yt * 0.85)
    tq_w = [P(X0, py - ph, 0.02, E * 0.025), P(X0, py + ph, 0.02, E * 0.025), P(X0, py + ph, 0.02, -E * 0.02), P(X0, py - ph, 0.02, -E * 0.02)]
    bq_w = [P(X0, py - ph, 0.60, E * 0.008), P(X0, py + ph, 0.60, E * 0.008), P(X0, py + ph, 0.60, -E * 0.008), P(X0, py - ph, 0.60, -E * 0.008)]
    PIT_OBJS.append(box_pts('pil_w', [tq_w, bq_w], wall_side, (sh, 0.0)))
    tq_e = [P(X1, py - ph, 0.02, -E * 0.025), P(X1, py + ph, 0.02, -E * 0.025), P(X1, py + ph, 0.02, E * 0.02), P(X1, py - ph, 0.02, E * 0.02)]
    bq_e = [P(X1, py - ph, 0.60, -E * 0.008), P(X1, py + ph, 0.60, -E * 0.008), P(X1, py + ph, 0.60, E * 0.008), P(X1, py - ph, 0.60, E * 0.008)]
    PIT_OBJS.append(box_pts('pil_e', [tq_e, bq_e], wall_side, (sh, 0.0)))

# 4. North (far) broken slab edge + subtle rim + sparse rebar
x = X0
while x < X1:
    seg_w = min(random.uniform(36, 86), X1 - x)
    in_lane = (x + seg_w > LANE0 + 6 and x < LANE1 - 6)
    if not in_lane:
        k_bot = random.uniform(0.055, 0.088); jut = random.uniform(0.012, 0.055)
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

# 5. Sparse, scale-graded debris (6 pieces) + 3 hanging cables
debris_m = pit_mat('debris', (130, 148, 164), rough=0.88, noise=0.32, fog_mid=-1.8, fog_end=-3.2, emit=((22, 40, 56), 0.14), use_vcol=False)
for sx, sy, dk, sz in ((225, NY, 0.10, 0.09), (855, NY, 0.13, 0.08), (535, NY, 0.24, 0.06), (725, NY, 0.32, 0.048), (420, NY, 0.40, 0.04), (990, NY, 0.48, 0.032)):
    loc = P(sx, sy, dk, -N * 0.04)
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

# 6. Near (South) broken lip (separate pass)
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

# 7. Lights: overhead cool light catching the top bevels of the strata + gentle fill into the mid-cliff
def light_aim(kind, loc, target, energy, col, size=1.0):
    ld = bpy.data.lights.new(kind, kind); ld.energy = energy; ld.color = col
    if kind == 'AREA': ld.size = size
    o = bpy.data.objects.new(kind, ld); sc.collection.objects.link(o); o.location = loc
    d = (Vector(target) - Vector(loc)).normalized()
    o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); return o

# High grazing overhead light shining down onto the strata top bevels across the whole width
light_aim('AREA', unproj(640, 390, 3.2), unproj(640, 290, -1.5), 760, (0.72, 0.88, 1.0), size=11.0)
# Angled key from upper-left-front so pilasters & fractured strata show clear 3D relief
light_aim('SUN', (0, 0, 5), (-0.38, 0.80, -0.82), 1.6, (0.74, 0.88, 1.0))
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
