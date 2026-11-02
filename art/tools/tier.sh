#!/bin/bash
# usage: tier.sh N "one-line progress note" path1 path2 ...   (paths relative to /workspace)
# builds /workspace/pi-art-v6-P<N>.tar.gz (+ docs), splits into /workspace/v6P<N>.part.* if > 2.5 MB, logs PROGRESS.md
set -e
N=$1; NOTE=$2; shift 2
cd /workspace
cp games/HANDOFF.md games/AGENTS.md; cp games/HANDOFF.md games/CLAUDE.md
DOCS="games/HANDOFF.md games/AGENTS.md games/CLAUDE.md games/prompt-injection/CREDITS.md games/prompt-injection/art-v6/README.md games/prompt-injection/art-v6/PROGRESS.md"
TB=pi-art-v6-P$N.tar.gz
echo "- $(date '+%Y-%m-%d %H:%M IST') · P$N done · $NOTE · tarball /workspace/$TB" >> games/prompt-injection/art-v6/PROGRESS.md
rm -f $TB v6P$N.part.*
tar czf $TB "$@" $DOCS
SZ=$(stat -c %s $TB)
if [ $SZ -gt 2560000 ]; then split -b 2500k $TB v6P$N.part.; echo "split: $(ls v6P$N.part.* | tr '\n' ' ')"; fi
ls -la $TB
