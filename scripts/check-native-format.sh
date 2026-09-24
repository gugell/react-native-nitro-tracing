#!/bin/bash
set -euo pipefail

# clang-format is not on PATH on a stock macOS install; Xcode ships one.
formatter="$(command -v clang-format || xcrun --find clang-format 2>/dev/null || true)"
if [ -z "$formatter" ]; then
  echo "error: clang-format not found. Install it (brew install clang-format) or Xcode." >&2
  exit 1
fi
package=packages/react-native-nitro-tracing
"$formatter" --dry-run --Werror \
  "$package"/cpp/*.cpp "$package"/cpp/*.hpp \
  "$package"/cpp/core/*.cpp "$package"/cpp/core/*.hpp \
  "$package"/tests/*.cpp
