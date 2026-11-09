# Simple desk lamp: base disk, 2 arm cylinders, cone shade, emissive bulb. Office lighting.
import bpy, sys, math, os
from mathutils import Vector, Euler

OUT = sys.argv[sys.argv.index('--')+1]
SAMPLES = int(sys.argv[sys.argv.index('--')+2]) if len(sys.argv) > sys.argv.index('--')+2 else 64
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; R = math.radians

def clear():
  for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
  for b in list(bpy.data.meshes): bpy.data.meshes.remove(b)
  for m in list(bpy.data.materials): bpy.data.materials.remove(m)
  for c in list(bpy.data.cameras): bpy.data.cameras.remove(c)
  for l in list(bpy.data.lights): bpy.data.lights.remove(l)

def mat(name, col, rough=0.4, metal=0.0, emit=0.0):
  m = bpy.data.materials.new(name); m.use_nodes = True
  b = m.node_tree.nodes['Principled BSDF']
  b.inputs['Base Color'].default_value = (*col, 1)
  b.inputs['Roughness'].default_value = rough
  b.inputs['Metallic'].default_value = metal
  if emit > 0:
    b.inputs['Emission Color'].default_value = (*col, 1)
    b.inputs['Emission Strength'].default_value = emit
  return m

def setup():
  w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
  w.node_tree.nodes['Background'].inputs[0].default_value = (0.012, 0.018, 0.028, 1)
  w.node_tree.nodes['Background'].inputs[1].default_value = 0.22
  def L(n, loc, e, col, size=1.4):
    ld = bpy.data.lights.new(n, 'AREA'); ld.energy = e; ld.color = col; ld.size = size
    o = bpy.data.objects.new(n, ld); o.location = loc; sc.collection.objects.link(o)
  L('key', (1.2, -1.6, 2.0), 110, (1.0, 0.88, 0.72))
  L('fill', (-1.4, -0.8, 1.2), 40, (0.5, 0.65, 1.0), 2.0)
  L('rim', (0.2, 1.4, 1.5), 50, (0.65, 0.8, 1.0))
  sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES
  sc.cycles.use_denoising = True; sc.render.film_transparent = True
  sc.view_settings.view_transform = 'AgX'
  sc.view_settings.look = 'AgX - Medium High Contrast'
  sc.render.image_settings.color_mode = 'RGBA'
  sc.render.image_settings.file_format = 'PNG'
  sc.render.resolution_x = sc.render.resolution_y = 256

def frame(objs, pad=1.4, yaw=-30, pitch=38):
  bpy.context.view_layer.update()
  coords = []
  for o in objs:
    if o.type != 'MESH': continue
    for c in o.bound_box: coords.append(o.matrix_world @ Vector(c))
  mn = Vector(tuple(min(c[i] for c in coords) for i in range(3)))
  mx = Vector(tuple(max(c[i] for c in coords) for i in range(3)))
  center = (mn+mx)/2; size = max((mx-mn).length, 0.1)
  cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = size*pad
  cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
  e = Euler((R(90-pitch), 0, R(yaw)), 'XYZ')
  cam.rotation_euler = e
  cam.location = center - (e.to_matrix() @ Vector((0,0,-1))) * (size*3+2)

def build_lamp(on=True):
  clear(); setup()
  metal = mat('metal', (0.55, 0.57, 0.60), 0.32, 0.9)
  metal_d = mat('metald', (0.32, 0.34, 0.38), 0.4, 0.85)
  shade_col = (0.88, 0.75, 0.48) if on else (0.42, 0.40, 0.38)
  shade = mat('shade', shade_col, 0.5)
  objs = []
  # Base disk
  bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.09, depth=0.02, location=(0,0,0.01))
  o = bpy.context.object; o.data.materials.append(metal_d); objs.append(o)
  bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.055, depth=0.015, location=(0,0,0.025))
  o = bpy.context.object; o.data.materials.append(metal); objs.append(o)
  # Lower arm — parented pivot at base then rotate
  bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.012, depth=0.20, location=(0,0,0.12))
  arm1 = bpy.context.object; arm1.data.materials.append(metal); objs.append(arm1)
  arm1.rotation_euler = (R(25), 0, R(20))
  # Elbow
  bpy.ops.mesh.primitive_uv_sphere_add(radius=0.02, location=(0.04, -0.02, 0.22))
  ej = bpy.context.object; ej.data.materials.append(metal); objs.append(ej)
  # Upper arm
  bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.01, depth=0.16, location=(0.08, -0.04, 0.32))
  arm2 = bpy.context.object; arm2.data.materials.append(metal); objs.append(arm2)
  arm2.rotation_euler = (R(40), 0, R(25))
  # Shade cone
  bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.10, radius2=0.04, depth=0.09,
    location=(0.12, -0.06, 0.42), rotation=(R(30), 0, R(25)))
  sh = bpy.context.object; sh.data.materials.append(shade); objs.append(sh)
  # Bulb
  bpy.ops.mesh.primitive_uv_sphere_add(radius=0.025, location=(0.12, -0.06, 0.40))
  bulb = bpy.context.object
  bulb.data.materials.append(mat('bulb', (1.0, 0.95, 0.8), 0.3, 0.0, 14.0 if on else 0.05))
  objs.append(bulb)
  if on:
    ld = bpy.data.lights.new('loc', 'POINT'); ld.energy = 20; ld.color = (1.0, 0.85, 0.55)
    lo = bpy.data.objects.new('loc', ld); lo.location = (0.12, -0.06, 0.40); sc.collection.objects.link(lo)
  frame(objs, pad=1.35, yaw=-28, pitch=38)
  path = os.path.join(OUT, f"lamp_{'on' if on else 'off'}.png")
  sc.render.filepath = path
  bpy.ops.render.render(write_still=True)
  print('wrote', path)

build_lamp(True)
build_lamp(False)
print('DONE')
