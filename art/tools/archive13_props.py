# art-v13 GB-5b: three quiet props for the Archive's right half, from the Kenney Furniture Kit (CC0, already credited):
#   a13_shelf   bookcaseClosedDoors  against the back wall
#   a13_lamp    lampSquareFloor      a warm floor lamp beside the exit (the only prop that gives light)
#   a13_boxes   two cardboardBoxClosed stacked, tied, on the floor
# Rendered on the game's 3/4 ortho camera at 2x, graded colder in archive13_post.py.
# usage: blender -b --python archive13_props.py -- OUTDIR [samples]
import bpy, math, sys, os, json
sys.argv_backup = sys.argv
argv = sys.argv[sys.argv.index('--') + 1:]
sys.argv = [sys.argv[0], '--', argv[0], 'x', argv[1] if len(argv) > 1 else '64']   # reuse archive13.py helpers without running its renders
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'archive13.py')).read()
src = src[:src.index('# ------------------------------------------------------------------ Dez')]   # helpers only
exec(compile(src, 'archive13_helpers', 'exec'))

def render_prop(name, parts, W, H, centre, scale=1.0, lamp=False):
    sc = reset(); cam = camera(sc, W, H, centre, ortho=max(W, H) / (PXU * 1.12))   # same px per metre as Dez's desk
    z = 0.0
    for (f, loc, rz, sc_) in parts:
        h, new = glb(FK + f, (loc[0], loc[1], z), rz, scale=sc_ * scale, centre=True)
        bpy.context.view_layer.update()
        z = max(v for o in new if o.type == 'MESH' for v in [(o.matrix_world @ Vector(c)).z for c in o.bound_box])
    light('SUN', (0, 0, 5), 1.4, (0.55, 0.78, 0.92), 12, (R(-38), R(12), R(8)))
    light('SUN', (0, 0, 5), 1.1, (0.40, 0.52, 0.70), 30, (R(48), 0, R(-20)), False)
    if lamp: light('POINT', (0.0, -0.05, 0.62), 28, (1.0, 0.72, 0.42), 0.06)
    bpy.context.view_layer.update()
    meta = dict(w=W, h=H, foot=px(sc, cam, (0, 0, 0)))
    save(sc, name, meta)

render_prop('a13_shelf', [('bookcaseClosedDoors.glb', (0, 0, 0), 0, 1.0)], 300, 260, (0, 0, 0.55), scale=float(os.environ.get('SH', 1.0)))
render_prop('a13_lamp', [('lampSquareFloor.glb', (0, 0, 0), 0, 1.0)], 120, 260, (0, 0, 0.60), scale=float(os.environ.get('LP', 0.9)), lamp=True)
render_prop('a13_boxes', [('cardboardBoxClosed.glb', (0, 0, 0), R(8), 1.0), ('cardboardBoxClosed.glb', (0.0, 0.0, 0.0), R(-12), 0.82)], 200, 200, (0, 0, 0.30), scale=float(os.environ.get('BX', 0.72)))
print('ARCHIVE13 PROPS DONE')
