#!/bin/bash
set -euo pipefail

# Exercises scripts/release.sh on both paths with a stubbed pnpm, so nothing is
# published, committed or tagged.
#
# The real release path and the dry-run path differ in one way that matters:
# the `offline` and `flags` arrays are EMPTY on a real release. Under `set -u`,
# bash 3.2 (what macOS ships) treats expanding an empty array as an unbound
# variable, so a script verified only with --dry-run can still fail on the day
# it is used for real. That happened; this is the check.

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
stub="$(mktemp -d)"
trap 'rm -rf "$stub"' EXIT

cat > "$stub/pnpm" <<STUB
#!/bin/bash
for arg in "\$@"; do
  case "\$arg" in
  --release-version)
    # Answer a prerelease request with a prerelease version, so the script is
    # exercised on the shape it will really see.
    for other in "\$@"; do
      case "\$other" in
      --preRelease=*) echo "9.9.9-\${other#--preRelease=}.0"; exit 0 ;;
      esac
    done
    echo "9.9.9"
    exit 0
    ;;
  esac
done
echo "\$*" >> "$stub/calls"
exit 0
STUB
chmod +x "$stub/pnpm"

run() {
  local label="$1"
  local expected="$2"
  shift 2
  local output
  : > "$stub/calls"
  if ! output="$(PATH="$stub:$PATH" GITHUB_TOKEN=stub bash "$root/scripts/release.sh" "$@" 2>&1)"; then
    echo "release.sh failed on the $label path:" >&2
    echo "$output" >&2
    exit 1
  fi
  case "$output" in
  *"Releasing version $expected"*) ;;
  *)
    echo "release.sh did not resolve a version on the $label path:" >&2
    echo "$output" >&2
    exit 1
    ;;
  esac
  echo "  $label path ok"
}

# What reached release-it, as opposed to what the script printed.
calls() { cat "$stub/calls"; }

run "release (empty flag arrays)" 9.9.9 --no-increment
# --no-increment means "publish what the manifest already says". Passing the
# version positionally as well makes release-it attempt a bump, and
# `npm version 0.1.0` on a package already at 0.1.0 fails with
# "Version not changed" — which is how this surfaced, mid-release.
if calls | grep -q "9\.9\.9"; then
  echo "release.sh passed a version positionally alongside --no-increment:" >&2
  calls >&2
  exit 1
fi
echo "    and did not pass a version positionally"

run "dry-run (populated flag arrays)" 9.9.9 --dry-run
run "explicit increment" 9.9.9 minor
if ! calls | grep -q "9\.9\.9"; then
  echo "release.sh did not pass the resolved version to release-it:" >&2
  calls >&2
  exit 1
fi
echo "    and passed the resolved version to both passes"

# A prerelease must reach BOTH passes as a prerelease. If the package pass
# published 9.9.9-alpha.0 while the root tagged 9.9.9, the registry and the tag
# would disagree about what was released.
run "prerelease" 9.9.9-alpha.0 --preRelease=alpha
# Exactly two: the one publishable package and the root pass. packages/* also
# holds private sample packages, which release.sh skips — without that skip a
# sample gets a version bump and a changelog for something nobody installs.
if [ "$(calls | grep -c -- "--preRelease=alpha")" -ne 2 ]; then
  echo "release.sh did not forward --preRelease to both passes:" >&2
  calls >&2
  exit 1
fi
if ! calls | grep -q "9\.9\.9-alpha\.0"; then
  echo "release.sh did not pass the resolved prerelease version to release-it:" >&2
  calls >&2
  exit 1
fi
echo "    and forwarded the prerelease to both passes"

echo "release.sh runs on every path."
