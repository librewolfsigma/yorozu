#!/usr/bin/env bash
# =============================================================================
# Yozora runtime provisioning (recycle-proof rebuild)
#
# The sandbox occasionally recycles everything outside /home/z/my-project.
# Everything this script needs and produces lives INSIDE the project:
#
#   .toolchain/go*                    Go SDK (installed to .toolchain/go)
#   .toolchain/gopath, .toolchain/gocache  module + build caches (warm rebuilds)
#   vendor/yozora                     fork clone (librewolfsigma/yozora, GPL-3.0)
#   .yozora/runtime/seanime-server    the built product binary (UI embedded)
#   .yozora/data/                     SQLite, settings, installed extensions
#
# After provisioning, NO action is needed to boot: the Next.js instrumentation
# keepalive (src/lib/seanime-runtime.ts) spawns the binary on 127.0.0.1:43211
# automatically; /api/bridge-boot can also trigger it on demand.
#
# Usage:
#   scripts/provision-yozora-runtime.sh            # ensure binary exists (fast path)
#   scripts/provision-yozora-runtime.sh --force    # rebuild web UI + binary
# =============================================================================
set -euo pipefail

PROJECT=/home/z/my-project
FORK_DIR="$PROJECT/vendor/yozora"
TOOLCHAIN_DIR="$PROJECT/.toolchain"
RUNTIME_DIR="$PROJECT/.yozora/runtime"
DATA_DIR="$PROJECT/.yozora/data"
FORK_URL="https://github.com/librewolfsigma/yozora.git"
GO_VERSION="1.27.3"

FORCE=false
[[ "${1:-}" == "--force" ]] && FORCE=true

log() { echo "[provision] $*"; }

# --- 1. Go toolchain ---------------------------------------------------------
if [[ ! -x "$TOOLCHAIN_DIR/go/bin/go" ]]; then
  log "installing Go $GO_VERSION"
  mkdir -p "$TOOLCHAIN_DIR"
  if [[ ! -f "$TOOLCHAIN_DIR/go$GO_VERSION.linux-amd64.tar.gz" ]]; then
    curl -fsSL -o "$TOOLCHAIN_DIR/go$GO_VERSION.linux-amd64.tar.gz" \
      "https://go.dev/dl/go$GO_VERSION.linux-amd64.tar.gz"
  fi
  rm -rf "$TOOLCHAIN_DIR/go"
  tar -xzf "$TOOLCHAIN_DIR/go$GO_VERSION.linux-amd64.tar.gz" -C "$TOOLCHAIN_DIR"
fi
export PATH="$TOOLCHAIN_DIR/go/bin:$PATH"
export GOPATH="$TOOLCHAIN_DIR/gopath"
export GOMODCACHE="$GOPATH/pkg/mod"
export GOCACHE="$TOOLCHAIN_DIR/gocache"
export CGO_ENABLED=0
log "go: $(go version)"

# --- 2. Fork clone -----------------------------------------------------------
if [[ ! -d "$FORK_DIR/.git" ]]; then
  log "cloning fork $FORK_URL"
  mkdir -p "$PROJECT/vendor"
  git clone --depth 300 "$FORK_URL" "$FORK_DIR"
fi

# --- 3. Binary ---------------------------------------------------------------
BIN="$RUNTIME_DIR/seanime-server"
if [[ -x "$BIN" && "$FORCE" == false ]]; then
  log "binary present: $BIN ($(du -h "$BIN" | cut -f1)) — nothing to do"
  exit 0
fi

log "building web UI (rsbuild, typecheck skipped)"
cd "$FORK_DIR/seanime-web"
if [[ ! -d node_modules ]]; then
  log "installing web deps (npm ci)"
  npm ci --no-audit --no-fund --loglevel=error
fi
npx rsbuild build
rm -rf "$FORK_DIR/web"
cp -r out "$FORK_DIR/web"

log "building server binary"
mkdir -p "$RUNTIME_DIR" "$DATA_DIR"
cd "$FORK_DIR"
go build -o "$BIN" -trimpath -ldflags="-s -w" .
log "built: $BIN ($(du -h "$BIN" | cut -f1))"

# --- 4. Config ----------------------------------------------------------------
if [[ ! -f "$DATA_DIR/config.toml" ]]; then
  log "seeding config.toml (passwordless + preview-origin allowlist)"
  cat > "$DATA_DIR/config.toml" <<'TOML'
version = "0.0.0"

[server]
host = "127.0.0.1"
port = 43211
offline = false
useBinaryPath = true
password = ""
secureMode = ""
accessAllowlist = ["*.space-z.ai"]
trustedProxies = ["127.0.0.1"]

[database]
name = "seanime"

[web]
assetDir = "/home/z/my-project/.yozora/data/assets"

[cache]
dir = "/home/z/my-project/.yozora/data/cache"
transcodeDir = "/home/z/my-project/.yozora/data/cache/transcode"

[logs]
dir = "/home/z/my-project/.yozora/data/logs"

[manga]
downloadDir = "/home/z/my-project/.yozora/data/manga"
localDir = "/home/z/my-project/.yozora/data/manga-local"

[offline]
dir = "/home/z/my-project/.yozora/data/offline"
assetDir = "/home/z/my-project/.yozora/data/offline/assets"

[extensions]
dir = "/home/z/my-project/.yozora/data/extensions"

[torrent]
dir = "/home/z/my-project/.yozora/data/torrent"
TOML
fi

log "done. Boot happens automatically via instrumentation keepalive;"
log "or force it now: curl -s http://127.0.0.1:3000/api/bridge-boot"
