#!/bin/bash
set -euo pipefail

# Release in two passes, which is how release-it expects a workspace to publish:
#
#   1. every package under packages/* publishes ITSELF to npm (git and GitHub
#      disabled in its own release-it config), and
#   2. the repository root makes one version bump commit, one tag and one
#      GitHub release for the whole workspace (npm publishing disabled).
#
# Both passes receive the same arguments, so they agree on the increment:
#   ./scripts/release.sh patch
#   ./scripts/release.sh --dry-run
#   ./scripts/release.sh --no-increment --ci --npm.skipChecks

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

dry_run=false
for argument in "$@"; do
  case "$argument" in
  --dry-run | -d) dry_run=true ;;
  esac
done

# A dry run is an offline rehearsal: it computes the next version and changelog
# from local history without contacting npm, GitHub or an upstream remote.
offline=()
if [ "$dry_run" = true ]; then
  offline=(
    --ci
    --no-npm.publish
    --npm.skipChecks
    --no-github.release
    --no-git.push
    --no-git.requireUpstream
    --no-git.requireBranch
    --no-git.requireCleanWorkingDir
  )
fi

ensure_github_token() {
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    return
  fi
  if [ -n "${GH_TOKEN:-}" ]; then
    export GITHUB_TOKEN="$GH_TOKEN"
    return
  fi
  if command -v gh >/dev/null 2>&1; then
    local token
    token="$(gh auth token 2>/dev/null || true)"
    if [ -n "$token" ]; then
      export GITHUB_TOKEN="$token"
      return
    fi
  fi
  echo "error: GITHUB_TOKEN is required to create the GitHub release." >&2
  echo "Run 'gh auth login', export a token with repo scope, or rehearse with --dry-run." >&2
  exit 1
}

if [ "$dry_run" = false ]; then
  ensure_github_token
fi

# Resolve ONE version for both passes. Without this each package takes
# release-it's own default — a patch bump — while the root computes its version
# from the conventional commits, and the two disagree: packages publish 0.1.1
# while the tag says 0.2.0. Positional arguments (patch, minor, 1.2.3) are
# consumed here and replaced by the concrete version; flags still pass through.
flags=()
no_increment=false
for argument in "$@"; do
  case "$argument" in
  --no-increment) no_increment=true; flags+=("$argument") ;;
  -*) flags+=("$argument") ;;
  esac
done

# The offline flags belong here too: computing the version still runs
# release-it's git checks, and a dry run on a branch other than main would
# otherwise fail the `requireBranch` check before printing anything.
#
# `${arr[@]+"${arr[@]}"}` rather than `"${arr[@]}"`: under `set -u`, bash 3.2 —
# which is what macOS ships — treats expanding an EMPTY array as an unbound
# variable. Both arrays are empty on a real release, and only the dry run
# fills them, so the plain form fails exactly where it matters.
version_log="$(mktemp)"
if ! version="$(pnpm exec release-it --release-version "$@" ${offline[@]+"${offline[@]}"} 2>"$version_log")"; then
  echo "error: could not determine the next version. Pass one explicitly, e.g. 'patch' or '1.2.3'." >&2
  cat "$version_log" >&2
  rm -f "$version_log"
  exit 1
fi
rm -f "$version_log"
version="$(printf '%s\n' "$version" | tail -1)"
if [ -z "$version" ]; then
  echo "error: release-it did not report a version." >&2
  exit 1
fi
echo "Releasing version $version"

# With --no-increment the intent is to publish the version already in the
# manifest. Passing it positionally as well makes release-it treat it as an
# explicit bump, and `npm version 0.1.0` on a package already at 0.1.0 fails
# with "Version not changed". The flag alone says everything.
positional=("$version")
if [ "$no_increment" = true ]; then
  positional=()
fi

for package in packages/*; do
  # A directory with no manifest is not a package — a leftover build directory
  # must not be treated as one and published.
  [ -f "$package/package.json" ] || continue
  # Private packages are samples and fixtures. They are not published, and
  # running release-it against one still bumps its version and writes a
  # changelog for something nobody installs.
  if node -e "process.exit(require('./$package/package.json').private ? 0 : 1)"; then
    echo "Skipping private package '$(basename "$package")'"
    continue
  fi
  echo "Publishing '$(basename "$package")' to npm"
  (cd "$package" && pnpm exec release-it ${positional[@]+"${positional[@]}"} ${flags[@]+"${flags[@]}"} ${offline[@]+"${offline[@]}"})
done

# An initial release (--no-increment) publishes a changelog written by hand: the
# history before it was not in conventional commits. Keep that section, and use
# it as the GitHub release notes instead of regenerating from the commits.
initial=()
if [ "$no_increment" = true ]; then
  initial=(
    "--plugins.@release-it/conventional-changelog.infile="
    "--github.releaseNotes=node scripts/release-notes.mjs $version"
  )
fi

echo "Creating the version bump commit, tag and GitHub release"
pnpm exec release-it ${positional[@]+"${positional[@]}"} ${flags[@]+"${flags[@]}"} ${offline[@]+"${offline[@]}"} ${initial[@]+"${initial[@]}"}

echo "Released react-native-nitro-tracing."
