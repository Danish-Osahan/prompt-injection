# art-v5 shared "actor rig": the one light set used for every character sprite AND (light-linked) for the same
# characters inside the room mocks, so sprites and mocks match by construction (fixes v4's hair-brightness drift).
# Calm direction: one warm key, one soft teal rim, a faint magenta accent rim, indigo fill, warm bounce.
import bpy, math
from mathutils import Euler, Matrix
_RR = math.radians
ACTOR_LIGHTS = [  # (energy, colour, euler deg (camera-relative, sprite camera yaw 0), angle deg, cast shadow)
    (2.5, (1.00, 0.84, 0.68), (42, 0, -32), 8, True),     # warm key, front-left
    (2.6, (0.36, 0.86, 0.92), (-64, 0, 48), 4, False),    # soft teal rim, back-left
    (0.9, (1.00, 0.36, 0.70), (-64, 0, -52), 4, False),   # faint magenta accent rim, back-right
    (0.65, (0.52, 0.58, 0.95), (60, 0, 15), 20, False),   # indigo fill from the camera
    (0.45, (1.00, 0.66, 0.42), (75, 0, 160), 10, False),  # warm bounce under the chin
]
def actor_rig(scene, cam_zrot_deg=0.0, receivers=None, scale=1.0):
    """Create the actor suns. cam_zrot_deg = camera Z rotation (room camera yaw -30 -> +30) so lighting stays
    screen-relative. receivers: a collection -> the suns light only those objects (light linking)."""
    out = []
    Rz = Matrix.Rotation(_RR(cam_zrot_deg), 4, 'Z')
    for (e, col, rot, ang, sh) in ACTOR_LIGHTS:
        l = bpy.data.lights.new('actorL', 'SUN'); l.energy = e*scale; l.color = col; l.angle = _RR(ang); l.cycles.cast_shadow = sh
        o = bpy.data.objects.new('actorL', l); scene.collection.objects.link(o)
        o.matrix_world = Rz @ Euler([_RR(a) for a in rot]).to_matrix().to_4x4()
        if receivers is not None:
            o.light_linking.receiver_collection = receivers
        out.append(o)
    return out
