#!/usr/bin/env bash
# Fail CI when route identities drift from docs/ROUTE_MANIFEST.md, or when a
# file outside the single escrow service writes wallet/ledger rows.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MANIFEST="docs/ROUTE_MANIFEST.md"
# Reserved path for the one module allowed to mutate wallet/ledger rows.
# The module itself is not created until build-order step 1.
ESCROW_MODULE="src/escrow"
FAIL=0

if [[ ! -f "$MANIFEST" ]]; then
  echo "FAIL: $MANIFEST is missing"
  exit 1
fi

# --- (a) Manifest identities must be unique ---
manifest_ids="$(
  awk -F'|' '
    NR <= 2 { next }
    /^[[:space:]]*\|/ {
      id = $3
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", id)
      if (id != "") print id
    }
  ' "$MANIFEST"
)"

if [[ -n "$manifest_ids" ]]; then
  dupes="$(printf '%s\n' "$manifest_ids" | sort | uniq -d)"
  if [[ -n "$dupes" ]]; then
    echo "FAIL: duplicate Identity in $MANIFEST (one path+identity → one row):"
    printf '%s\n' "$dupes"
    FAIL=1
  fi
fi

# Collect source files that might register routes/events/actions.
mapfile -t SOURCE_FILES < <(
  find . \
    \( -path './.git' -o -path './node_modules' -o -path './dist' -o -path './coverage' \) -prune -o \
    -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.mts' -o -name '*.cts' \) \
    -print 2>/dev/null | sed 's|^\./||' | sort
)

# Extract REST method+path, socket event names, and TABLE_ACTIONS-style literals.
extract_code_identities() {
  local file="$1"
  # Express-style: app|router.get('/path'  and io/socket.on('event'
  grep -Eho "(app|router)\.(get|post|put|patch|delete)\(\s*['\"][^'\"]+['\"]" "$file" 2>/dev/null \
    | sed -E "s/.*(get|post|put|patch|delete)\(\s*['\"]([^\"]+)['\"].*/\U\1\E \2/" || true
  grep -Eho "(io|socket|nsp)\.on\(\s*['\"][^'\"]+['\"]" "$file" 2>/dev/null \
    | sed -E "s/.*\.on\(\s*['\"]([^\"]+)['\"].*/\1/" || true
}

declare -A CODE_HITS=()
if ((${#SOURCE_FILES[@]})); then
  for file in "${SOURCE_FILES[@]}"; do
    while IFS= read -r ident; do
      [[ -z "$ident" ]] && continue
      if [[ -n "${CODE_HITS[$ident]+x}" ]]; then
        echo "FAIL: identity '$ident' is registered in both ${CODE_HITS[$ident]} and $file without a single shared manifest entry"
        FAIL=1
      else
        CODE_HITS[$ident]="$file"
      fi
      # Must appear in the manifest (Kind + Identity columns concatenated as "KIND path")
      if [[ -n "$manifest_ids" ]] && ! printf '%s\n' "$manifest_ids" | grep -Fxq "$ident"; then
        echo "FAIL: '$ident' in $file is not registered in $MANIFEST"
        FAIL=1
      elif [[ -z "$manifest_ids" ]]; then
        echo "FAIL: '$ident' in $file is not registered in $MANIFEST (manifest has no entries yet)"
        FAIL=1
      fi
    done < <(extract_code_identities "$file")
  done
fi

# --- (b) Wallet / ledger row writes only in $ESCROW_MODULE ---
WRITE_PATTERN='prisma\.(wallet|ledger|personalLedger|escrow)|INSERT[[:space:]]+INTO[[:space:]]+(wallet|ledger|personal_ledger|escrow)|UPDATE[[:space:]]+(wallet|ledger|personal_ledger|escrow)|(\.wallet|\.ledger|\.personalLedger|\.escrow)\.(create|update|upsert|delete|deleteMany)'

mapfile -t WRITE_HITS < <(
  grep -RInE --exclude-dir='.git' --exclude-dir='node_modules' --exclude-dir='dist' --exclude-dir='coverage' \
    -E "$WRITE_PATTERN" . 2>/dev/null \
    | grep -v "^${MANIFEST}:" \
    | grep -v '^scripts/check-routes.sh:' \
    | grep -v '^docs/' \
    | grep -v '^migrations/' \
    | grep -v "^\.cursorrules:" \
    | grep -v '^PROGRESS.md:' \
    | grep -v '^jetonbro-requirements-v4.md:' \
    || true
)

for hit in "${WRITE_HITS[@]+"${WRITE_HITS[@]}"}"; do
  [[ -z "$hit" ]] && continue
  file="${hit%%:*}"
  file="${file#./}"
  case "$file" in
    "$ESCROW_MODULE"/*) continue ;;
    src/ledger/*)
      if [[ "$hit" == *personal_ledger* ]]; then
        continue
      fi
      echo "FAIL: wallet/ledger write outside $ESCROW_MODULE/: $hit"
      FAIL=1
      ;;
    *)
      echo "FAIL: wallet/ledger write outside $ESCROW_MODULE/: $hit"
      FAIL=1
      ;;
  esac
done

if [[ "$FAIL" -ne 0 ]]; then
  echo
  echo "check-routes: failed (see FAIL lines above)"
  exit 1
fi

echo "check-routes: ok"
exit 0
