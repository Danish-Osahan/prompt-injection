# art-v12: the hub rift as a real chasm, rendered with the room camera (ortho 8.4, pitch 38, yaw -30) so it lands 1:1 on
# game screen coords. Output: RGBA layer (floor on both sides is holdout) -> game/public/assets/rooms/fg/hub_rift.png.
# The rift cuts through the building: the far face shows storeys of floor slab, ceiling void, ducts and cut rebar falling
# away into cold fog. Game RIFT = x 80..1200, north lip y 248, south lip y 404; the bridge lane x 592..688 stays open.
# usage: blender -b --python rift12.py -- OUTDIR [SAMPLES]
import bpy, math, random, sys, os
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]; OUT = argv[0]; SAMPLES = int(argv[1]) if len(argv) > 1 else 64
bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene; R = math.radians; random.seed(12)
O7 = 8.4; T7 = R(90 - 38); Y7 = R(30)
RIGHT = Vector((math.cos(Y7), math.sin(Y7), 0)); UP = Vector((-math.sin(Y7)*math.cos(T7), math.cos(Y7)*math.cos(T7), math.sin(T7)))
PXZ = UP.z*1280/O7
def unproj(sx, sy, z=0.0):
    u = (sx - 640)*O7/1280; v = (360 - sy)*O7/1280; dz = z - 0.5
    a, b, c, d = RIGHT.x, RIGHT.y, UP.x, UP.y; r1 = u - RIGHT.z*dz; r2 = v - UP.z*dz; det = a*d - b*c
    return Vector(((r1*d - b*r2)/det, (a*r2 - c*r1)/det, z))
cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = O7; cd.clip_end = 100
cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
t = R(90 - 38); yw = R(-30); dirv = Vector((math.sin(yw)*math.sin(t), math.cos(yw)*math.sin(t), -math.cos(t)))
cam.location = Vector((0, 0, 0.5)) - dirv*20; cam.rotation_euler = (t, 0, -yw)
# frame: north = away from camera on screen-up. 'n' is the world direction of screen-up on the floor.
N = (unproj(640, 300) - unproj(640, 310)).normalized(); E = (unproj(650, 300) - unproj(640, 300)).normalized()
def L3(c): return tuple(((v/255) ** 2.2) for v in c)
def fog_mat(name, rgb, rough=0.85, metal=0.0, emit=None, noise=0.25):
    """concrete-ish surface whose colour sinks into cold fog with depth (world z): lit near the lip, gone by z -3.6"""
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; ns = nt.nodes; L = nt.links
    bs = ns['Principled BSDF']; bs.inputs['Roughness'].default_value = rough; bs.inputs['Metallic'].default_value = metal
    tc = ns.new('ShaderNodeTexCoord'); nz = ns.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 9; nz.inputs['Detail'].default_value = 6
    L.new(tc.outputs['Object'], nz.inputs['Vector'])
    mix = ns.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.inputs['A'].default_value = (*[v*(1 - noise) for v in L3(rgb)], 1); mix.inputs['B'].default_value = (*L3(rgb), 1)
    L.new(nz.outputs['Fac'], mix.inputs['Factor']); L.new(mix.outputs['Result'], bs.inputs['Base Color'])
    if emit: bs.inputs['Emission Color'].default_value = (*L3(emit[0]), 1); bs.inputs['Emission Strength'].default_value = emit[1]
    geo = ns.new('ShaderNodeNewGeometry'); sep = ns.new('ShaderNodeSeparateXYZ'); L.new(geo.outputs['Position'], sep.inputs['Vector'])
    mr = ns.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = -0.08; mr.inputs['From Max'].default_value = -1.2
    mr.inputs['To Min'].default_value = 0.0; mr.inputs['To Max'].default_value = 1.0; L.new(sep.outputs['Z'], mr.inputs['Value']); pw = ns.new('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = 0.6; L.new(mr.outputs['Result'], pw.inputs[0])
    fe = ns.new('ShaderNodeEmission'); fe.inputs['Color'].default_value = (*L3((9, 16, 26)), 1); fe.inputs['Strength'].default_value = 1.0
    ms = ns.new('ShaderNodeMixShader'); L.new(pw.outputs['Value'], ms.inputs['Fac']); L.new(bs.outputs['BSDF'], ms.inputs[1]); L.new(fe.outputs['Emission'], ms.inputs[2])
    L.new(ms.outputs['Shader'], ns['Material Output'].inputs['Surface']); return m
hold = bpy.data.materials.new('hold'); hold.use_nodes = True; hn = hold.node_tree.nodes; hn.remove(hn['Principled BSDF'])
ho = hn.new('ShaderNodeHoldout'); hold.node_tree.links.new(ho.outputs[0], hn['Material Output'].inputs['Surface'])
def boxw(name, c, sx, sy, sz, mat, rz=0.0, rx=0.0, ry=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=c); o = bpy.context.object; o.name = name; o.scale = (sx, sy, sz)
    o.rotation_euler = (rx, ry, math.atan2(E.y, E.x) + rz); o.data.materials.append(mat); return o
def quadw(name, pts, mat):
    me = bpy.data.meshes.new(name); me.from_pydata(pts, [], [list(range(len(pts)))]); o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); o.data.materials.append(mat); return o
def W(sx, z): return unproj(sx, 248, 0.0) + Vector((0, 0, z))
WL = (unproj(1200, 248) - unproj(80, 248)).length
mid_n = (unproj(80, 248) + unproj(1200, 248)) / 2
# holdout floors (north slab top and the south floor) so the layer cuts exactly at both lips
quadw('northfloor', [unproj(40, 248), unproj(1240, 248), unproj(1240, 120), unproj(40, 120)], hold)
quadw('southfloor', [unproj(40, 720), unproj(1240, 720), unproj(1240, 404), unproj(40, 404)], hold)
conc = fog_mat('conc', (92, 100, 112)); slab = fog_mat('slab', (108, 116, 128), noise=0.4); dark = fog_mat('void', (30, 38, 52))
ceil = fog_mat('ceil', (104, 108, 110), noise=0.15); duct = fog_mat('duct', (96, 108, 120), rough=0.4, metal=0.7); reb = fog_mat('rebar', (120, 80, 60), rough=0.6, metal=0.6)
cyan = fog_mat('lipglow', (40, 60, 70), emit=((120, 228, 232), 2.2))
# far face: a continuous backing (so nothing shows through), then storeys every 0.34 (slab, ceiling void, recessed wall)
SH = 0.34
bk = W(640, -1.6) + N*0.6; boxw('backing', bk, WL + 0.4, 0.05, 3.4, dark)
for k in range(5):
    z0 = -0.02 - k*SH
    for seg in range(28):
        if random.random() < 0.35: continue
        x0 = 80 + seg*40; c = W(x0 + 20, z0 - SH*0.55) + N*(0.16 + random.uniform(0.0, 0.5))
        boxw('inner', c, 40*O7/1280*1.03, 0.04, SH*0.75, dark if random.random() < 0.7 else conc, rz=random.uniform(-0.05, 0.05))
    x = 80
    while x < 1200:
        w = min(random.uniform(50, 170), 1200 - x); jut = random.uniform(-0.04, 0.14) + (0.05 if k == 0 else 0)
        if not (x + w > 592 and x < 688 and k == 0) and (k == 0 or random.random() > 0.3):
            th = 0.05 + random.uniform(0, 0.03)
            c = W(x + w/2, z0 - th/2) + N*(0.1 - jut)
            boxw('slab', c + N*0.06, w*O7/1280*0.98, 0.1, th, slab, rz=random.uniform(-0.02, 0.02), ry=random.uniform(-0.04, 0.04))
            if k > 0:
                for tx in range(int(x) + 4, int(x + w) - 14, 18):
                    if random.random() < 0.65: continue
                    drop = random.uniform(0, 0.05); tilt = random.uniform(-0.6, 0.6) if random.random() < 0.2 else 0
                    boxw('tile', W(tx + 7, z0 - th - 0.05 - drop) + N*(0.06 - jut*0.5), 15*O7/1280, 0.05, 0.008, ceil, rx=tilt)
            for _ in range(int(w // 22)):
                rx = random.uniform(x + 4, x + w - 4); ln = random.uniform(0.05, 0.16)
                bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.005, depth=ln, location=W(rx, z0 - random.uniform(0.01, th)) - N*(jut + ln/2 - 0.02),
                                                    rotation=(R(90) + random.uniform(-0.7, 0.2), 0, math.atan2(N.y, N.x) - R(90)))
                bpy.context.object.data.materials.append(reb)
        x += w + random.uniform(0, 10)
    if k in (1, 3):
        x0 = random.uniform(80, 260); x1 = random.uniform(900, 1200)
        boxw('duct', unproj((x0 + x1)/2, 248, z0 - SH*0.5) + N*0.12, (x1 - x0)*O7/1280, 0.1, 0.08, duct)
# the top slab's lit lip: a thin cyan safety strip along the edge (it was in the plate as the cyan edge line)
for x0, x1 in ((80, 588), (692, 1200)):
    boxw('lip', unproj((x0 + x1)/2, 248, -0.012) + N*0.02, (x1 - x0)*O7/1280, 0.03, 0.02, cyan)
# broken slab chunks hanging in the gap at different depths
for (sx, sy, z, s) in ((240, 318, -0.45, 0.22), (452, 352, -0.9, 0.16), (820, 330, -0.6, 0.2), (1010, 370, -0.35, 0.14), (930, 384, -1.1, 0.26), (330, 372, -1.0, 0.12)):
    boxw('chunk', unproj(sx, sy, z), s, s*random.uniform(0.5, 0.9), s*0.3, slab, rz=random.uniform(-0.6, 0.6), rx=random.uniform(-0.4, 0.4), ry=random.uniform(-0.3, 0.3))
# end walls (room side walls continue down)
for sx in (80, 1200):
    c = unproj(sx, 326, -2.0); boxw('endwall', c, 0.08, (unproj(sx, 248) - unproj(sx, 404)).length + 1.2, 4.0, conc)
# lights: a grazing cold key from the room (lights the slab faces), a warm wash from the hub floor, cold light far below
def light(kind, loc, energy, col, size=1.0, rot=None, spot=None):
    ld = bpy.data.lights.new(kind, kind); ld.energy = energy; ld.color = col
    if kind == 'AREA': ld.size = size
    if kind == 'SPOT': ld.spot_size = R(spot or 60); ld.spot_blend = 0.8
    o = bpy.data.objects.new(kind, ld); sc.collection.objects.link(o); o.location = loc
    if rot: o.rotation_euler = rot
    return o
sun = light('SUN', (0, 0, 5), 2.8, (0.78, 0.88, 1.0)); sun.rotation_euler = (cam.rotation_euler.x - R(12), 0, cam.rotation_euler.z + R(28))
light('AREA', unproj(640, 320, -1.7), 120, (0.45, 0.8, 0.95), size=12.0)
sw = bpy.data.worlds.new('w'); sc.world = sw; sw.use_nodes = True; sw.node_tree.nodes['Background'].inputs['Color'].default_value = (0.004, 0.007, 0.012, 1)
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
sc.render.resolution_x = 1280; sc.render.resolution_y = 720; sc.render.film_transparent = True
sc.render.use_border = True; sc.render.use_crop_to_border = False; sc.render.border_min_x = 0; sc.render.border_max_x = 1; sc.render.border_min_y = 1 - 420/720; sc.render.border_max_y = 1 - 236/720
sc.view_settings.view_transform = 'Standard'; sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
exec(open("/tmp/dbg.py").read()) if os.environ.get("DBG") else None
os.makedirs(OUT, exist_ok=True); sc.render.filepath = os.path.join(OUT, 'hub_rift.png'); bpy.ops.render.render(write_still=True)
