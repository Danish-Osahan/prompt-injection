#!/bin/bash
# full art-v5 render chain (Blender 4.2 LTS, Cycles CPU + OIDN denoise). ~35-45 min on 8 cores at these sample counts.
# Long steps are niced; run the whole script in the background:  nohup ./render_all.sh > render_all.log 2>&1 &
set -e
cd "$(dirname "$0")"
B=${BLENDER:-/opt/tools/blender-4.2.9-linux-x64/blender}
python3 make_tex_v5.py                                                            # tex/ (floor, letter, static, fakedoor, window...)
nice $B -b --python sprites.py -- idle,walk,attack ../render/sprites 24            # Noor 8 dirs, 176 frames
nice $B -b --python enemy_sprites.py -- autocomplete,sycophant,warden,redactor,hallucinator,caret ../render/sprites 16
nice $B -b --python scene5.py -- room2 ../render/v5 1280 720 48                   # Floor 2 Open Plan
nice $B -b --python scene5.py -- room1 ../render/v5 1280 720 48                   # Floor 1 Archive
nice $B -b --python scene5.py -- room3 ../render/v5 1280 720 48                   # Floor 2 Break Room (quiet exploration)
nice $B -b --python scene5.py -- castF ../render/v5 1280 640 32                   # Fern plate for the cast sheet
python3 pack5.py noor autocomplete sycophant warden redactor hallucinator caret   # out/sprites/*.png/.json/.gif
python3 post5.py room2 && python3 post5.py room1 && python3 post5.py room3        # out/H5_*_1280x720.png (+ overlap QA)
python3 cast5.py                                                                   # out/H5_cast_sheet.png + H5_palette.png
