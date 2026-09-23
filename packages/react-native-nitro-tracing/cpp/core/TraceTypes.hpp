#pragma once
#include <cstdint>
#include <string>
#include <variant>
#include <vector>
namespace margelo::nitro::tracingcore {
struct Attribute {
  std::string key;
  std::string value;
};
struct Context {
  std::string name;
  std::string correlationId;
  std::vector<Attribute> attributes;
};
enum class Outcome { Success, Error, Cancelled, Interrupted };
struct SpanData {
  std::string spanId;
  std::string parentSpanId;
  double durationMs;
  Outcome outcome;
};
struct MarkData {};
struct MetricData {
  double value;
  std::string unit;
};
struct Event {
  uint64_t sequence;
  double timestampMs;
  Context context;
  std::variant<SpanData, MarkData, MetricData> data;
};
struct Config {
  size_t maxEvents;
  size_t maxBytes;
  size_t maxActiveSpans;
  double spanTimeoutMs;
};
struct Stats {
  std::string sessionId;
  double startedAtUnixMs;
  double nowMs;
  bool recording;
  size_t eventCount;
  size_t retainedBytes;
  uint64_t droppedEvents;
  size_t activeSpans;
};
struct Page {
  std::vector<Event> events;
  uint64_t nextSequence;
  uint64_t earliestSequence;
  uint64_t droppedEvents;
};
struct Snapshot {
  Stats stats;
  Page page;
};
} // namespace margelo::nitro::tracingcore
