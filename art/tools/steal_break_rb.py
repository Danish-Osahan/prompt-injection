# Rigid-body-authored chain + padlock break for steal OPEN (v9).
# Transparent passes for compositing into the office plate.
# Usage: blender -b --python art/tools/steal_break_rb.py -- OUTDIR [SAMPLES]
import bpy, sys, math, os, json
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
OUT = argv[0]
SAMPLES = int(argv[1]) if len(argv) > 1 else 32
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
R = math.radians
FRAME = 640
PX_PER_UNIT = 1280 / 8.4
ORTHO = FRAME / PX_PER_UNIT

def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for b in list(bpy.data.meshes):
        bpy.data.meshes.remove(b)
    for c in list(bpy.data.curves):
        bpy.data.curves.remove(c)
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)
    for c in list(bpy.data.cameras):
        bpy.data.cameras.remove(c)
    for l in list(bpy.data.lights):
        bpy.data.lights.remove(l)
    for w in list(bpy.data.worlds):
        bpy.data.worlds.remove(w)

def setup_cam(foot_y=300, ortho_scale=None, res=FRAME):
    if ortho_scale is None:
        ortho_scale = ORTHO * 0.72  # tighter crop on the lock
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs[0].default_value = (0.01, 0.015, 0.03, 1)
    bg.inputs[1].default_value = 0.05
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = ortho_scale
    cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
    t = R(90 - 38); cam.rotation_euler = (t, 0, 0)
    d = Vector((0, math.sin(t), -math.cos(t)))
    up = Vector((0, math.cos(t), math.sin(t)))
    off = (foot_y - res / 2) / PX_PER_UNIT
    # look at lock height ~0.55
    target = Vector((0.0, 0.15, 0.50))
    cam.location = target - d * 12 + up * off

    def L(name, loc, energy, color, typ='AREA', size=1.4):
        ld = bpy.data.lights.new(name, typ); ld.energy = energy; ld.color = color
        if typ == 'AREA':
            ld.size = size
        o = bpy.data.objects.new(name, ld); o.location = loc; sc.collection.objects.link(o)
        return o
    L('key', (2.2, -2.8, 4.2), 280, (1.0, 0.94, 0.88), 'AREA', 2.0)
    L('fill', (-2.4, -1.2, 2.0), 70, (0.5, 0.68, 1.0), 'AREA', 2.4)
    L('rim', (0.4, 2.4, 2.6), 140, (0.7, 0.85, 1.0), 'AREA', 1.4)
    # warm bounce from "floor"
    L('bounce', (0.2, -0.5, 0.3), 40, (0.9, 0.75, 0.55), 'AREA', 3.0)

    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 8
    sc.cycles.transparent_max_bounces = 16
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = res
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.fps = 24

def mat_metal(name, col=(0.65, 0.68, 0.74), rough=0.22, metal=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*col, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    return m

def mat_pad(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.18, 0.16, 0.16, 1)
    bsdf.inputs['Roughness'].default_value = 0.38
    bsdf.inputs['Metallic'].default_value = 0.92
    # slight rim via emission so it reads on dark door
    bsdf.inputs['Emission Color'].default_value = (0.35, 0.38, 0.42, 1)
    bsdf.inputs['Emission Strength'].default_value = 0.25
    return m

def mat_emit(name, col, strength=10.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*col, 1)
    bsdf.inputs['Emission Color'].default_value = (*col, 1)
    bsdf.inputs['Emission Strength'].default_value = strength
    return m

def mat_wind():
    """Soft shaded gust — translucent body + bright core. BLEND, not hashed dither."""
    m = bpy.data.materials.new('wind'); m.use_nodes = True
    m.blend_method = 'BLEND'
    try:
        m.use_backface_culling = False
        m.show_transparent_back = False
    except Exception:
        pass
    try:
        m.shadow_method = 'NONE'
    except Exception:
        pass
    nt = m.node_tree; nodes = nt.nodes; links = nt.links
    for n in list(nodes):
        if n.type != 'OUTPUT_MATERIAL':
            nodes.remove(n)
    out = nodes['Material Output']
    # Layer Weight fresnel → mix emission + transparent
    lw = nodes.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.45
    em = nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (0.75, 0.92, 1.0, 1)
    em.inputs['Strength'].default_value = 4.5
    em2 = nodes.new('ShaderNodeEmission')
    em2.inputs['Color'].default_value = (0.45, 0.75, 0.95, 1)
    em2.inputs['Strength'].default_value = 1.8
    tr = nodes.new('ShaderNodeBsdfTransparent')
    mix1 = nodes.new('ShaderNodeMixShader')
    mix2 = nodes.new('ShaderNodeMixShader')
    # fresnel edges brighter
    links.new(lw.outputs['Fresnel'], mix1.inputs['Fac'])
    links.new(em2.outputs[0], mix1.inputs[1])
    links.new(em.outputs[0], mix1.inputs[2])
    # overall transparency
    mix2.inputs['Fac'].default_value = 0.42
    links.new(tr.outputs[0], mix2.inputs[1])
    links.new(mix1.outputs[0], mix2.inputs[2])
    links.new(mix2.outputs[0], out.inputs['Surface'])
    return m

def mat_contact_shadow():
    m = bpy.data.materials.new('cshadow'); m.use_nodes = True
    m.blend_method = 'BLEND'
    try:
        m.shadow_method = 'NONE'
    except Exception:
        pass
    nt = m.node_tree; nodes = nt.nodes; links = nt.links
    for n in list(nodes):
        if n.type != 'OUTPUT_MATERIAL':
            nodes.remove(n)
    out = nodes['Material Output']
    em = nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (0.02, 0.03, 0.05, 1)
    em.inputs['Strength'].default_value = 1.0
    tr = nodes.new('ShaderNodeBsdfTransparent')
    mix = nodes.new('ShaderNodeMixShader')
    mix.inputs['Fac'].default_value = 0.55  # mostly transparent
    links.new(tr.outputs[0], mix.inputs[1])
    links.new(em.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], out.inputs['Surface'])
    return m

def render(path):
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print('saved', path, flush=True)

def build_link(metal, major=0.085, minor=0.026):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor,
        major_segments=36, minor_segments=16)
    o = bpy.context.object
    o.data.materials.append(metal)
    bpy.ops.object.shade_smooth()
    return o

def build_padlock(dark, led_mat):
    bpy.ops.mesh.primitive_cube_add(size=1)
    body = bpy.context.object
    body.scale = (0.18, 0.10, 0.15)
    bpy.ops.object.transform_apply(scale=True)
    # bevel
    bpy.ops.object.modifier_add(type='BEVEL')
    body.modifiers['Bevel'].width = 0.012
    body.modifiers['Bevel'].segments = 3
    bpy.ops.object.modifier_apply(modifier='Bevel')
    body.data.materials.append(dark)
    bpy.ops.object.shade_smooth()

    bpy.ops.mesh.primitive_torus_add(major_radius=0.09, minor_radius=0.02,
                                    major_segments=32, minor_segments=14)
    sh = bpy.context.object
    sh.rotation_euler = (R(90), 0, 0)
    sh.scale = (0.9, 1.1, 0.9)
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    sh.data.materials.append(dark)
    bpy.ops.object.shade_smooth()

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.028)
    led = bpy.context.object
    led.data.materials.append(led_mat)
    return body, sh, led

def add_floor_shadow_discs(positions):
    """Soft contact shadow ellipses under settled pieces (transparent pass)."""
    m = mat_contact_shadow()
    for (x, y, z, rw, rh) in positions:
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=1, depth=0.005,
                                           location=(x, y, max(0.005, z)))
        o = bpy.context.object
        o.scale = (rw, rh, 1)
        o.data.materials.append(m)

def place_chain(metal, dark, led_mat, taut=0.0):
    links = []
    n = 7
    span = 0.72
    for i in range(n):
        u = i / (n - 1)
        x = -span / 2 + u * span
        z = 0.58 + math.sin(u * math.pi) * (0.04 - taut * 0.035)
        y = 0.22 + taut * 0.03  # in front of imaginary door
        link = build_link(metal)
        link.name = f'link_{i}'
        link.location = (x, y, z)
        link.rotation_euler = (R(90 if i % 2 else 10), R(taut * 8), R(90))
        s = 1.0 + taut * 0.1
        link.scale = (s, 1.0, s)
        links.append(link)
    body, sh, led = build_padlock(dark, led_mat)
    body.name = 'pad_body'; sh.name = 'pad_shackle'; led.name = 'pad_led'
    cx, cy, cz = 0.0, 0.24, 0.42 - taut * 0.02
    body.location = (cx, cy, cz)
    sh.location = (cx, cy, cz + 0.12)
    led.location = (cx, cy + 0.06, cz + 0.01)
    # point light for LED
    ld = bpy.data.lights.new('ledL', 'POINT'); ld.energy = 25; ld.color = (1.0, 0.15, 0.08)
    lo = bpy.data.objects.new('ledL', ld); lo.location = (cx, cy + 0.1, cz); sc.collection.objects.link(lo)
    return links, body, sh, led

def ballistic(p0, v0, t, floor_z=0.04, restitution=0.45):
    g = -9.8
    x = p0.x + v0.x * t
    y = p0.y + v0.y * t
    # integrate with bounces
    z = p0.z
    vz = v0.z
    dt = 1 / 24
    steps = max(1, int(t / dt))
    rem = t - steps * dt
    for _ in range(steps):
        z += vz * dt + 0.5 * g * dt * dt
        vz += g * dt
        if z < floor_z:
            z = floor_z
            vz = -vz * restitution
            x += v0.x * dt * 0.3
            y += v0.y * dt * 0.3
            if abs(vz) < 0.5:
                vz = 0
                break
    z += vz * rem + 0.5 * g * rem * rem
    if z < floor_z:
        z = floor_z
    return Vector((x, y, z))

def render_break():
    metal = None
    # taut frames
    for i, taut in enumerate([0.0, 0.4, 0.75, 1.0]):
        clear(); setup_cam()
        metal = mat_metal('chain')
        dark = mat_pad('pad')
        led_mat = mat_emit('led', (1.0, 0.12, 0.08), 36.0)
        place_chain(metal, dark, led_mat, taut=taut)
        render(os.path.join(OUT, f'taut_{i:02d}.png'))

    # snap ballistic
    clear(); setup_cam(ortho_scale=ORTHO * 0.85)  # slightly wider for scatter
    metal = mat_metal('chain')
    dark = mat_pad('pad')
    led_mat = mat_emit('led', (1.0, 0.12, 0.08), 28.0)
    links, body, sh, led = place_chain(metal, dark, led_mat, taut=1.0)

    specs = []
    for i, link in enumerate(links):
        side = -1.0 if i < 3 else (0.0 if i == 3 else 1.0)
        vx = side * (1.6 + 0.4 * abs(i - 3)) + (i - 3) * 0.2
        vy = 0.6 + 0.15 * (i % 3)
        vz = 3.0 + 0.55 * ((i % 5) - 2)
        spin = (R(50 + i * 30), R(-40 + i * 22), R(60 + i * 28))
        specs.append((link, Vector(link.location), Vector((vx, vy, vz)), spin))
    # padlock body falls right; shackle pops open up-left
    specs.append((body, Vector(body.location), Vector((1.4, 0.7, 3.5)), (R(70), R(40), R(100))))
    specs.append((sh, Vector(sh.location), Vector((-1.0, 1.0, 4.2)), (R(140), R(80), R(50))))
    specs.append((led, Vector(led.location), Vector((1.8, 0.4, 3.0)), (R(30), R(20), R(110))))

    n_snap = 20
    for fi in range(n_snap):
        t = fi / 24.0
        shadow_pos = []
        for obj, p0, v0, spin in specs:
            loc = ballistic(p0, v0, t)
            obj.location = loc
            obj.rotation_euler = (
                spin[0] * (1 + t * 2.4),
                spin[1] * (1 + t * 2.0),
                spin[2] * (1 + t * 2.8),
            )
            if loc.z < 0.12:
                shadow_pos.append((loc.x, loc.y, 0.008, 0.10, 0.055))
        # shackle open
        if fi >= 1:
            sh.rotation_euler = (R(30 + fi * 10), R(fi * 14), R(fi * 18))
        # rebuild soft contact shadows each frame
        # remove old shadow discs
        for o in list(bpy.data.objects):
            if o.name.startswith('Cylinder') or o.name.startswith('csh_'):
                bpy.data.objects.remove(o, do_unlink=True)
        for j, sp in enumerate(shadow_pos):
            bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=1, depth=0.004,
                                               location=(sp[0], sp[1], sp[2]))
            o = bpy.context.object; o.name = f'csh_{j}'
            o.scale = (sp[3], sp[4], 1)
            o.data.materials.append(mat_contact_shadow())
        render(os.path.join(OUT, f'snap_{fi:02d}.png'))

    for i in range(4):
        render(os.path.join(OUT, f'settle_{i:02d}.png'))

def render_soft_wind():
    for i in range(12):
        clear()
        setup_cam(foot_y=280, ortho_scale=ORTHO * 1.35, res=FRAME)
        wind = mat_wind()
        core_m = mat_emit('wcore', (0.85, 0.95, 1.0), 5.0)
        u = i / 11.0
        p0 = Vector((1.6, 0.05, 0.55))
        p1 = Vector((0.2, -0.2, 0.78))
        p2 = Vector((-1.4, 0.18, 0.58))
        def bez(t):
            a = p0.lerp(p1, t); b = p1.lerp(p2, t); return a.lerp(b, t)
        tip = bez(u)
        # chunky soft mass — large overlapping spheres
        for k in range(8):
            v = max(0.0, u - 0.06 * k)
            pt = bez(v)
            rad = (0.16 - k * 0.015) * (1.15 - 0.3 * u)
            if rad < 0.03:
                continue
            bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16,
                                                radius=rad, location=pt)
            o = bpy.context.object
            fwd = bez(min(1.0, v + 0.04)) - pt
            if fwd.length > 1e-4:
                o.rotation_mode = 'QUATERNION'
                o.rotation_quaternion = fwd.normalized().to_track_quat('Z', 'Y')
            o.scale = (0.75, 0.6, 1.7)
            o.data.materials.append(wind)
            bpy.ops.object.shade_smooth()
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.10 * (1.05 - 0.25 * u), location=tip)
        core = bpy.context.object
        core.data.materials.append(core_m)
        ld = bpy.data.lights.new('wg', 'POINT'); ld.energy = 55; ld.color = (0.6, 0.88, 1.0)
        lo = bpy.data.objects.new('wg', ld); lo.location = tip; sc.collection.objects.link(lo)
        render(os.path.join(OUT, f'wind_soft_{i:02d}.png'))

def render_door_flex():
    """Subtle metal door dent/flex pass (dark plate only, transparent bg)."""
    for i in range(6):
        clear(); setup_cam(foot_y=290, ortho_scale=ORTHO * 0.9)
        door_m = mat_metal('door', col=(0.10, 0.11, 0.13), rough=0.5, metal=0.4)
        u = i / 5.0
        kick = math.sin(u * math.pi) * math.exp(-u * 1.1)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.02 - 0.07 * kick, 0.55))
        door = bpy.context.object
        door.scale = (0.95 + 0.04 * kick, 0.05 - 0.02 * abs(kick), 1.25)
        bpy.ops.object.transform_apply(scale=True)
        door.data.materials.append(door_m)
        # dent
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.14 + 0.05 * kick,
                                            location=(0, -0.01 - 0.04 * kick, 0.60))
        dent = bpy.context.object
        dent.scale = (1.8, 0.3, 1.1)
        dent.data.materials.append(door_m)
        render(os.path.join(OUT, f'door_flex_{i:02d}.png'))

def main():
    print('=== steal_break_rb v2 →', OUT, 'spp', SAMPLES, flush=True)
    render_break()
    render_soft_wind()
    render_door_flex()
    meta = dict(taut=4, snap=20, settle=4, wind_soft=12, door_flex=6,
                frame=FRAME, samples=SAMPLES)
    with open(os.path.join(OUT, 'meta_break.json'), 'w') as f:
        json.dump(meta, f, indent=2)
    print('DONE', OUT, flush=True)

if __name__ == '__main__':
    main()
