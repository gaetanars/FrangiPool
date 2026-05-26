#!/usr/bin/env bash
# Validates conventional commit format for git commit -m commands.
# Reads Claude Code PreToolUse JSON from stdin.
# Exit 0 = allow | Exit 2 = block with feedback shown to Claude.

input=$(cat)
cmd=$(echo "$input" | python3 -c "import sys,json; print(json.load(sys.stdin).get('command',''))" 2>/dev/null)

# Only intercept git commit (with or without rtk prefix)
if ! echo "$cmd" | grep -qE '^(rtk )?git commit'; then
  exit 0
fi

# Without -m: editor-based commit, can't validate here
if ! echo "$cmd" | grep -q -- '-m'; then
  exit 0
fi

# Skip --no-verify: user is explicitly bypassing hooks
if echo "$cmd" | grep -q -- '--no-verify'; then
  exit 0
fi

# Extract the commit message from -m "..." or -m '...'
msg=$(echo "$cmd" | python3 -c "
import sys, re
cmd = sys.stdin.read()
m = re.search(r'-m\s+[\"\'](.*?)[\"\']', cmd, re.DOTALL) \
    or re.search(r'-m\s+(\S+)', cmd)
print(m.group(1).strip() if m else '')
" 2>/dev/null)

if [ -z "$msg" ]; then
  exit 0  # can't parse, allow through
fi

# Validate: type(scope)!?: description
# First line only (multi-line messages via heredoc pass the first line here)
first_line=$(echo "$msg" | head -1)

if echo "$first_line" | grep -qE '^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\([^)]+\))?(!)?: .+'; then
  exit 0
fi

cat >&2 <<EOF
❌ Message invalide : '$first_line'

Format conventionnel requis : type(scope)?: description
Types valides : feat, fix, docs, style, refactor, test, chore, perf, ci, build, revert

Exemples :
  feat(filtration): add winter mode temperature threshold
  fix(redox): correct EMA filter coefficient on pool_redox
  docs(ph): document two-point calibration procedure
  chore: bump esphome to 2026.4.0
  refactor(base): rename g_forced_remaining_s global

Conseil : utilise git commit sans -m pour ouvrir l'éditeur si le message est complexe.
EOF
exit 2
