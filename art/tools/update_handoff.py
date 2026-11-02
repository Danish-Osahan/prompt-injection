# replace the art section of /workspace/games/HANDOFF.md (from '### Latest art:' up to '### Next steps (in order)') with handoff_art.md
import os
H = '/workspace/games/HANDOFF.md'; s = open(H).read(); new = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'handoff_art.md')).read()
a = s.index('### Latest art:'); b = s.index('### Next steps (in order)')
s = s[:a] + new.rstrip() + '\n\n' + s[b:]
open(H, 'w').write(s)
for n in ('AGENTS.md', 'CLAUDE.md'): open('/workspace/games/'+n, 'w').write(s)
print('handoff updated')
