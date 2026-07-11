#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root_dir"

load_env_file() {
  local file="$1"

  if [[ -f "$file" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "$file"
    set +a
  fi
}

load_env_file ".env"
load_env_file ".env.local"

if [[ -z "${SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET:-}" ]]; then
  echo "Missing SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET."
  echo "Add it to .env.local, then rerun npm run dev:all."
  exit 1
fi

if [[ "${1:-}" == "--restart" ]]; then
  supabase stop
fi

supabase start
npm run dev -- --host 127.0.0.1
