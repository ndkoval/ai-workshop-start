#!/usr/bin/env bash
set -euo pipefail
trap 'echo "Environment setup failed at line $LINENO" >&2' ERR

# The materialized startup script may run outside the checkout.
cd /workspaces/ai-workshop-start

node_version=24.13.0
case "$(uname -m)" in
  x86_64) node_arch=x64 ;;
  aarch64|arm64) node_arch=arm64 ;;
  *) echo 'Unsupported Node.js architecture' >&2; exit 1 ;;
esac
node_name="node-v${node_version}-linux-${node_arch}"
node_root="$HOME/.local/share/air-node"
node_bin="$node_root/$node_name/bin"
if [[ ! -x "$node_bin/node" ]]; then
  echo "Installing Node.js $node_version"
  mkdir -p "$node_root"
  (
    cd "$node_root"
    curl -fsSL -x "${HTTPS_PROXY:?HTTPS_PROXY is required}" "https://nodejs.org/dist/v$node_version/$node_name.tar.gz" -o "$node_name.tar.gz"
    curl -fsSL -x "$HTTPS_PROXY" "https://nodejs.org/dist/v$node_version/SHASUMS256.txt" -o SHASUMS256.txt
    grep " $node_name.tar.gz$" SHASUMS256.txt | sha256sum -c -
    tar -xzf "$node_name.tar.gz"
    rm "$node_name.tar.gz"
  )
fi

# Persist the runtime for both agent login shells and interactive terminals.
mkdir -p "$HOME/.config/air"
printf 'export PATH="%s:$PATH"\nexport NODE_USE_ENV_PROXY=1\n' "$node_bin" > "$HOME/.config/air/skill-atlas-env.sh"
hook='[ ! -f "$HOME/.config/air/skill-atlas-env.sh" ] || . "$HOME/.config/air/skill-atlas-env.sh"'
profile="$HOME/.profile"
for candidate in "$HOME/.bash_profile" "$HOME/.bash_login" "$HOME/.profile"; do
  if [[ -f "$candidate" ]]; then profile="$candidate"; break; fi
done
for target in "$profile" "$HOME/.bashrc"; do
  touch "$target"
  if ! grep -Fqx "$hook" "$target"; then printf '\n%s\n' "$hook" >> "$target"; fi
done
source "$HOME/.config/air/skill-atlas-env.sh"
node --version

# Reuse snapshotted dependencies unless the manifests or runtime changed.
dependency_key="$(cat package.json package-lock.json | sha256sum | cut -d ' ' -f 1)-$(node --version)-$node_arch"
if [[ ! -f node_modules/.air-dependency-key ]] || [[ "$(cat node_modules/.air-dependency-key)" != "$dependency_key" ]] || [[ ! -x node_modules/.bin/tsc ]]; then
  echo 'Installing locked npm dependencies'
  npm ci --prefer-offline --no-audit --no-fund
  printf '%s\n' "$dependency_key" > node_modules/.air-dependency-key
else
  echo 'Using cached npm dependencies'
fi

healthcheck() {
  echo 'Checking types, integration tests, and the real CLI'
  npm run typecheck
  npm test
  ./skill-atlas help
  local scan_output
  scan_output="$(./skill-atlas scan ./fixture)"
  printf '%s\n' "$scan_output"
  grep -Fqx 'fixture · 3 skills' <<< "$scan_output"
  echo 'Environment healthcheck passed'
}

# This CLI needs no background server. Tests synchronously prove readiness.
if [[ "${AIR_STARTUP_MODE:-}" == warmup ]]; then
  healthcheck
fi
