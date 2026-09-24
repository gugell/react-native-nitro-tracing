#pragma once
#include "TraceTypes.hpp"
namespace margelo::nitro::tracingcore {
std::string exportJson(const Snapshot &snapshot);
/** Chrome Trace Event JSON: opens in ui.perfetto.dev and chrome://tracing. */
std::string exportTraceEvents(const Snapshot &snapshot);
}
