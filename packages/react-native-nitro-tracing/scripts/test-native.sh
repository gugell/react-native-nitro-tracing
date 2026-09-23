#!/bin/sh
set -eu
OUT="${TMPDIR:-/tmp}/nitro-tracing-tests-$$"
trap 'rm -f "$OUT"' EXIT
c++ -std=c++20 -Wall -Wextra -Werror -O2 -pthread -Icpp/core tests/RecorderTest.cpp cpp/core/Recorder.cpp cpp/core/Retention.cpp cpp/core/TraceJson.cpp -o "$OUT"
"$OUT"
