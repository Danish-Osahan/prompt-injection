#!/bin/bash
# art-v8: render all six Phase 1 rooms (clean plates, fg alpha passes, ambient loops, bridge frames), then post + sync to the game.
# ~6-8 min on 8 cores.  usage: ./render_rooms8.sh [SAMPLES]
set -e
cd "$(dirname "$0")"
B=${BLENDER:-/opt/tools/blender-4.2.9-linux-x64/blender}; S=${1:-64}; R=../render/rooms
run() { nice "$B" -b --python scene7.py -- "$@" > /tmp/r8_$1.log 2>&1 || { echo "FAIL $1"; tail -20 /tmp/r8_$1.log; exit 1; }; echo "ok $1"; }
python3 make_tex_v8.py
NOTILES=1 FGPASS=1 AMBPASS=1                           run R7_office        $R 1280 720 $S
STATE=shut FGHIDE=door_panel NOTILES=1 FGPASS=1 AMBPASS=1 run R7_hub_shut   $R 1280 720 $S
STATE=open NOTILES=1                                   run R7_hub_open      $R 1280 720 $S
STATE=dark NOTILES=1 FGPASS=1 AMBPASS=1                run R7_corridor_dark $R 1280 720 $S
STATE=lit  NOTILES=1 AMBPASS=1                         run R7_corridor_lit  $R 1280 720 $S
STATE=H NOTILES=1 FGPASS=1 AMBPASS=1 BRIDGEANIM=8      run R7_archive_H     $R 1280 720 $S
STATE=L NOTILES=1 AMBPASS=1                            run R7_archive_L     $R 1280 720 $S
NOTILES=1 FGPASS=1 AMBPASS=1                           run R7_arena         $R 1280 720 $S
NOTILES=1 FGPASS=1 AMBPASS=1                           run R7_message       $R 1280 720 $S
python3 post7.py && python3 sync_game.py
