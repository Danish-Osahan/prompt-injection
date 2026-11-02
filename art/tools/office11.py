# art-v11 clarity pass for the OLD-ANGLE office (exec'd at the end of scene7.py when O11=1, mode R7_office, SKIPMAIN=1):
#  1. collision footprints: every solid prop's floor-level footprint (bbox at z=0, projected) -> R7_office_o11.json
#  2. an object-index pass with one index per prop group (game cuts depth-sort overlays from the graded plate with it)
#  3. lift door opening frames (border-cropped full renders; post11.py grades them into the plate)
#  4. a stuffed practice dummy sprite (alpha pass)
import json
from bpy_extras.object_utils import world_to_camera_view
O11 = OUT; cam = sc.camera; bpy.context.view_layer.update()
def scr(p): v = world_to_camera_view(sc, cam, Vector(p)); return (v.x*1280, (1 - v.y)*720)
def root(o):
    while o.parent: o = o.parent
    return o
SKIPN = ('floor', 'wall', 'window', 'mullion', 'sill', 'lift', 'wallpanel', 'whiteboard', 'calendar', 'stickycall', 'cable', 'sheet', 'rainlight', 'wbtray', 'jam', 'paper', 'rain', 'bead', 'line', 'pstack')
meshes = [o for o in sc.objects if o.type in ('MESH', 'CURVE') and not o.hide_render]
def wb(o):
    cs = [o.matrix_world @ Vector(c) for c in o.bound_box]; return cs
groups = {}
for o in meshes:
    r = root(o)
    if any(r.name.lower().startswith(s) for s in SKIPN) or any(o.name.lower().startswith(s) for s in SKIPN): continue
    groups.setdefault(r.name, []).append(o)
G = []
for nm, objs in groups.items():
    cs = [c for o in objs for c in wb(o)]; zmin = min(c.z for c in cs); zmax = max(c.z for c in cs)
    pts = [scr((c.x, c.y, 0.0)) for c in cs]; xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    G.append(dict(name=nm, objs=objs, zmin=zmin, zmax=zmax, pts=pts, bb=(min(xs), min(ys), max(xs), max(ys))))
def hull(P):
    P = sorted(set((round(x, 1), round(y, 1)) for x, y in P))
    if len(P) < 3: return P
    def cr(o, a, b): return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
    lo, up = [], []
    for p in P:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(P):
        while len(up) >= 2 and cr(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]
def inside(poly, x, y):
    c = False; n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]; x2, y2 = poly[(i+1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1)*(y - y1)/(y2 - y1 + 1e-9) + x1: c = not c
    return c
standing = [g for g in G if g['zmin'] < 0.12 and g['zmax'] > 0.08 and (g['bb'][2] - g['bb'][0]) < 400]
for g in standing: g['poly'] = hull(g['pts'])
ontop = [g for g in G if g['zmin'] >= 0.12]
for g in ontop:      # monitors, mugs, keyboards, the printer: belong to the furniture under them
    cx = sum(p[0] for p in g['pts'])/len(g['pts']); cy = sum(p[1] for p in g['pts'])/len(g['pts'])
    host = [s for s in standing if inside(s['poly'], cx, cy)]
    if host: host[0]['objs'] += g['objs']
for k, g in enumerate(standing):
    for o in g['objs']: o.pass_index = 100 + k
for o in meshes:
    if o.pass_index < 100: o.pass_index = 1
json.dump(dict(groups=[dict(idx=100 + k, name=g['name'], poly=[list(p) for p in g['poly']], baseY=max(p[1] for p in g['poly']), zmax=g['zmax']) for k, g in enumerate(standing)]),
          open(O11 + '/R7_office_o11.json', 'w'), indent=1)
print('O11 groups', len(standing), [g['name'] for g in standing])
# ---- 2. index pass (1 spp; no AA) ----
sc.cycles.samples = 1; sc.cycles.use_denoising = False; sc.render.filepath = O11 + '/o11_idxbeauty.png'
for n in sc.node_tree.nodes:
    if n.type == 'OUTPUT_FILE': n.base_path = O11; n.file_slots[0].path = 'o11_mist_'; n.file_slots[1].path = 'o11_index_'
bpy.ops.render.render(write_still=True)
sc.use_nodes = False
# ---- 3. lift doors ----
liftm = bpy.data.materials.get('lift'); gapm = bpy.data.materials.get('liftgap')
for o in meshes:
    if o.type == 'MESH' and o.data.materials and o.data.materials[0] in (liftm, gapm): o.hide_render = True
inside_m = img_mat('liftin', TX8 + 'lift_inside.png', emit=0.42, rough=0.6)
on_wall(150, 260, 80, 200, 200, inside_m, eps=0.012, name='liftin')
pans = []
def door_pose(u):
    for p in pans: bpy.data.objects.remove(p, do_unlink=True)
    pans.clear(); w = 55*(1 - u)
    if w > 0.5:
        pans.append(on_wall(150, 150 + w, 80, 200, 200, liftm, eps=0.02, name='liftL'))
        pans.append(on_wall(260 - w, 260, 80, 200, 200, liftm, eps=0.02, name='liftR'))
        if u < 0.02: pans.append(on_wall(203, 207, 80, 200, 200, gapm, eps=0.024, name='liftseam'))
lt = L_at('AREA', 205, 214, 0.75, 0, (1.0, 0.86, 0.66), 0.7, aim_to=tuple(unproj(205, 300)))
sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
sc.render.use_border = True; sc.render.use_crop_to_border = False
sc.render.border_min_x = 110/1280; sc.render.border_max_x = 310/1280; sc.render.border_min_y = 1 - 360/720; sc.render.border_max_y = 1 - 60/720
ND = int(os.environ.get('O11DOOR', '10'))
for k in range(ND):
    u = k/(ND - 1); e = u*u*(3 - 2*u); door_pose(e); lt.data.energy = 9*e
    sc.render.filepath = O11 + '/o11_door_%02d.png' % k; bpy.ops.render.render(write_still=True)
sc.render.use_border = False
# ---- 4. practice dummy (alpha pass) ----
DX, DY = 820, 610
wood = srgb('dwood', (120, 86, 54), rough=0.7); sack = srgb('dsack', (178, 148, 104), rough=0.95); rope = srgb('drope', (96, 74, 48), rough=0.9)
redm = srgb('dred', (170, 52, 44), rough=0.6)
q = unproj(DX, DY)
D = [box('dbase1', (0.42, 0.07, 0.05), (q.x, q.y, 0.025), wood, rot=(0, 0, R(SCR_RZ + 45))), box('dbase2', (0.42, 0.07, 0.05), (q.x, q.y, 0.025), wood, rot=(0, 0, R(SCR_RZ - 45)))]
bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.03, depth=0.55, location=(q.x, q.y, 0.3)); D.append(bpy.context.object); D[-1].data.materials.append(wood)
bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=0.2, location=(q.x, q.y, 0.78)); b = bpy.context.object; b.scale = (0.85, 0.7, 1.25); b.data.materials.append(sack); D.append(b)
bpy.ops.object.shade_smooth()
bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=0.12, location=(q.x, q.y, 1.16)); h = bpy.context.object; h.data.materials.append(sack); D.append(h); bpy.ops.object.shade_smooth()
for zz, rr in ((0.56, 0.15), (1.05, 0.10)):
    bpy.ops.mesh.primitive_torus_add(major_radius=rr, minor_radius=0.014, location=(q.x, q.y, zz)); t = bpy.context.object; t.data.materials.append(rope); D.append(t)
f = (unproj(DX, DY + 10) - unproj(DX, DY)).normalized()   # toward the camera on the floor
c = Vector((q.x, q.y, 0.8)) + Vector((f.x, f.y, 0))*0.168
bpy.ops.mesh.primitive_torus_add(major_radius=0.07, minor_radius=0.012, location=c, rotation=(R(90), 0, math.atan2(f.y, f.x) + R(90))); D.append(bpy.context.object); D[-1].data.materials.append(redm)
bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.026, depth=0.01, location=c + Vector((f.x, f.y, 0))*0.004, rotation=(R(90), 0, math.atan2(f.y, f.x) + R(90))); D.append(bpy.context.object); D[-1].data.materials.append(redm)
for o in pans: o.hide_render = True
lt.data.energy = 0
sc.render.use_border = True; sc.render.border_min_x = (DX - 90)/1280; sc.render.border_max_x = (DX + 90)/1280; sc.render.border_min_y = 1 - (DY + 30)/720; sc.render.border_max_y = 1 - (DY - 200)/720
iso_render(D, O11 + '/o11_dummy.png', SAMPLES)
json.dump(dict(dummy=dict(x=DX, y=DY)), open(O11 + '/R7_office_o11_dummy.json', 'w'))
print('O11 DONE')
