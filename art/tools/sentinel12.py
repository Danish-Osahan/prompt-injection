# art-v12: the corridor Sentinel, rendered with the room camera angle (pitch 38, yaw -30) at 2x so it reads at game size.
# A tailor's form built from flat sheets of blank claim forms on an iron stand with a four-foot base; the head is a blank
# ID-card plate (the game prints [NAME] / NOOR on it). Output: sentinel.png (RGBA) + sentinel.json (head-plate anchor).
# usage: blender -b --python sentinel12.py -- OUTDIR
import bpy, math, random, sys, os, json
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]; OUT = argv[0]; os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene; R = math.radians; random.seed(5)
ORTHO = 4.2; W, H = 300, 640     # 2x: 1 world unit = 1280/4.2 px at render, ~152 px in game at 0.5 scale
cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = ORTHO * max(W, H) / 1280; cd.clip_end = 100
cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
t = R(90 - 38); yw = R(-30); dirv = Vector((math.sin(yw)*math.sin(t), math.cos(yw)*math.sin(t), -math.cos(t)))
TGT = Vector((0, 0, 0.93)); cam.location = TGT - dirv*20; cam.rotation_euler = (t, 0, -yw)
FACE = R(30)   # rotate parts so the front faces the camera square-on
def L3(c): return tuple(((v/255) ** 2.2) for v in c)
def mat(name, rgb, rough=0.7, metal=0.0, emit=0.0, tex=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*L3(rgb), 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if tex:
        im = nt.nodes.new('ShaderNodeTexImage'); im.image = bpy.data.images.load(tex); nt.links.new(im.outputs['Color'], b.inputs['Base Color'])
    if emit: b.inputs['Emission Color'].default_value = (*L3(rgb), 1); b.inputs['Emission Strength'].default_value = emit
    return m
paper = mat('paper', (168, 162, 148), 0.85); paper2 = mat('paper2', (138, 134, 124), 0.9); ink = mat('ink', (40, 40, 48), 0.6)
iron = mat('iron', (34, 36, 40), 0.35, 0.8); red = mat('red', (170, 52, 44), 0.6); card = mat('card', (196, 192, 180), 0.5)
def boxo(name, loc, size, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o = bpy.context.object; o.name = name; o.scale = size
    o.rotation_euler = (rot[0], rot[1], FACE + rot[2]); o.data.materials.append(m); return o
# stand: four flat feet in a cross, a square iron post
for a in (0, 90, 180, 270):
    v = Vector((math.cos(R(a + 45)), math.sin(R(a + 45)), 0))*0.13
    boxo('foot', (v.x, v.y, 0.015), (0.26, 0.035, 0.03), iron, (0, 0, R(a + 45) - FACE))
boxo('post', (0, 0, 0.32), (0.03, 0.03, 0.62), iron)
# torso: faceted stack of paper bands (wider at chest and hip, pinched waist), each slightly offset like hand-glued sheets
prof = [(0.62, 0.15), (0.70, 0.19), (0.78, 0.21), (0.86, 0.19), (0.94, 0.16), (1.02, 0.20), (1.10, 0.24), (1.18, 0.25), (1.26, 0.22), (1.32, 0.14)]
for i, (z, r) in enumerate(prof):
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=r, depth=0.085, location=(random.uniform(-0.01, 0.01), random.uniform(-0.01, 0.01), z))
    o = bpy.context.object; o.scale = (1.0, 0.62, 1.0); o.rotation_euler = (random.uniform(-0.03, 0.03), random.uniform(-0.03, 0.03), FACE + R(22.5) + random.uniform(-0.08, 0.08))
    o.data.materials.append(paper if i % 2 else paper2)
# form lines, redaction bars and a slipped sheet on the chest (flat strips just proud of the front facets)
fwd = Vector((math.sin(FACE), -math.cos(FACE), 0)).normalized()
def front(z, r, dx=0.0): return Vector((math.cos(FACE), math.sin(FACE), 0))*dx + fwd*(r*0.62*0.95)
for z, r in prof[2:9]:
    p = front(z, r); boxo('line', (p.x, p.y, z + 0.02), (r*1.0, 0.004, 0.009), ink)
for (z, r, dx, w) in ((1.10, 0.24, -0.04, 0.16), (0.94, 0.16, 0.03, 0.10), (1.20, 0.25, 0.05, 0.12)):
    p = front(z, r, dx); boxo('redact', (p.x, p.y, z - 0.01), (w, 0.006, 0.022), ink)
p = front(1.02, 0.22, 0.1); boxo('slip', (p.x, p.y, 1.0), (0.12, 0.004, 0.2), card, (0, R(-14), 0))
p = front(0.86, 0.2, -0.12); boxo('tag', (p.x, p.y, 0.8), (0.05, 0.004, 0.14), red, (0, R(8), 0))
# shoulders: a flat yoke; neck: the post continues; head: a blank ID-card plate on a clip, tilted a little
boxo('yoke', (0, 0, 1.35), (0.40, 0.15, 0.025), paper2)
side = Vector((math.cos(FACE), math.sin(FACE), 0))
for sg in (-1, 1):   # sleeves: two long blank sheets hanging off the shoulders, one slipped forward
    q = side*sg*0.2 + fwd*(0.02 if sg > 0 else -0.01); boxo('sleeve', (q.x, q.y, 1.08), (0.07, 0.006, 0.52), paper if sg > 0 else paper2, (R(6*sg), R(-7*sg), 0))
    q2 = q + fwd*0.006; boxo('sline', (q2.x, q2.y, 1.18), (0.05, 0.004, 0.006), ink, (R(6*sg), R(-7*sg), 0)); boxo('sline', (q2.x, q2.y, 1.12), (0.05, 0.004, 0.006), ink, (R(6*sg), R(-7*sg), 0))
boxo('neck', (0, 0, 1.41), (0.03, 0.03, 0.12), iron)
boxo('clip', (0, 0, 1.47), (0.05, 0.02, 0.04), iron)
hp = boxo('head', (0, 0, 1.6), (0.32, 0.012, 0.22), card, (0, R(-4), 0))
boxo('headback', (0, 0, 1.6), (0.33, 0.008, 0.23), paper2, (0, R(-4), 0)); bpy.context.object.location += -fwd*0.012
boxo('bar', Vector((0, 0, 1.685)) + fwd*0.012, (0.32, 0.004, 0.03), ink, (0, R(-4), 0))
# lights: cool key from the camera side, warm rim from the exit, faint bounce
def light(kind, loc, energy, col, size=1.0, rot=(0, 0, 0)):
    ld = bpy.data.lights.new(kind, kind); ld.energy = energy; ld.color = col
    if kind == 'AREA': ld.size = size
    o = bpy.data.objects.new(kind, ld); sc.collection.objects.link(o); o.location = loc; o.rotation_euler = rot; return o
key = light('AREA', TGT - dirv*3 + Vector((-1.2, 0, 1.0)), 120, (0.78, 0.86, 1.0), 2.5); key.rotation_euler = (t - R(20), 0, -yw + R(25))
rim = light('AREA', (1.5, 1.6, 1.6), 140, (1.0, 0.8, 0.6), 1.2); rim.rotation_euler = (R(60), 0, R(140))
sw = bpy.data.worlds.new('w'); sc.world = sw; sw.use_nodes = True; sw.node_tree.nodes['Background'].inputs['Color'].default_value = (0.02, 0.03, 0.05, 1)
sc.render.engine = 'CYCLES'; sc.cycles.samples = 96; sc.cycles.use_denoising = True; sc.render.film_transparent = True
sc.render.resolution_x = W; sc.render.resolution_y = H; sc.view_settings.view_transform = 'Standard'
sc.render.image_settings.color_mode = 'RGBA'; sc.render.filepath = os.path.join(OUT, 'sentinel.png'); bpy.ops.render.render(write_still=True)
from bpy_extras.object_utils import world_to_camera_view
def px(v): q = world_to_camera_view(sc, cam, Vector(v)); return [round(q.x*W, 1), round((1 - q.y)*H, 1)]
json.dump(dict(w=W, h=H, foot=px((0, 0, 0)), head=px(hp.location + fwd*0.02), headW=0.30*1280/ORTHO), open(os.path.join(OUT, 'sentinel.json'), 'w'))
