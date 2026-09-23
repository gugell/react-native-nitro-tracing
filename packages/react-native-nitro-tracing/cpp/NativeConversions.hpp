#pragma once
#include "core/TraceTypes.hpp"
#include "TraceContext.hpp"
#include "TracePage.hpp"
#include "RecordingStats.hpp"
#include "RecordingOptions.hpp"
namespace margelo::nitro::nitrotracing {
tracingcore::Context toCore(const std::string& name, const std::string& id, const std::vector<TraceAttribute>& attributes);
tracingcore::Config toCore(const RecordingOptions& options);
tracingcore::Outcome toCore(SpanOutcome outcome);
TracePage toNative(const tracingcore::Page& page);
RecordingStats toNative(const tracingcore::Stats& stats);
uint64_t checkedInteger(double value, double maximum, const char* field);
}
