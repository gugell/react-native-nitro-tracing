#include "NativeConversions.hpp"
#include <cmath>
#include <stdexcept>
namespace margelo::nitro::nitrotracing {
uint64_t checkedInteger(double value, double maximum, const char *field) {
  if (!std::isfinite(value) || value < 0 || value > maximum || std::floor(value) != value)
    throw std::invalid_argument(std::string(field) + " must be a nonnegative integer within its documented limit");
  return static_cast<uint64_t>(value);
}
tracingcore::Context toCore(const std::string &name, const std::string &id, const std::vector<TraceAttribute> &attrs) {
  tracingcore::Context c{name, id, {}};
  c.attributes.reserve(attrs.size());
  for (const auto &a : attrs)
    c.attributes.push_back({a.key, a.value});
  return c;
}
tracingcore::Config toCore(const RecordingOptions &o) {
  // Range-checked above, so the casts are safe where size_t is 32-bit (armeabi-v7a).
  return {static_cast<size_t>(checkedInteger(o.maxEvents, 100000, "maxEvents")),
          static_cast<size_t>(checkedInteger(o.maxBytes, 67108864, "maxBytes")),
          static_cast<size_t>(checkedInteger(o.maxActiveSpans, 10000, "maxActiveSpans")), o.spanTimeoutMs};
}
tracingcore::Outcome toCore(SpanOutcome o) {
  switch (o) {
  case SpanOutcome::SUCCESS:
    return tracingcore::Outcome::Success;
  case SpanOutcome::ERROR:
    return tracingcore::Outcome::Error;
  case SpanOutcome::CANCELLED:
    return tracingcore::Outcome::Cancelled;
  case SpanOutcome::INTERRUPTED:
    return tracingcore::Outcome::Interrupted;
  }
  throw std::invalid_argument("Invalid span outcome");
}
RecordingStats toNative(const tracingcore::Stats &s) {
  return RecordingStats(s.sessionId, s.startedAtUnixMs, s.nowMs, s.recording, static_cast<double>(s.eventCount),
                        static_cast<double>(s.retainedBytes), static_cast<double>(s.droppedEvents),
                        static_cast<double>(s.activeSpans));
}
TracePage toNative(const tracingcore::Page &page) {
  TracePage p;
  p.nextSequence = page.nextSequence;
  p.earliestSequence = page.earliestSequence;
  p.droppedEvents = page.droppedEvents;
  for (const auto &e : page.events) {
    std::vector<TraceAttribute> attrs;
    attrs.reserve(e.context.attributes.size());
    for (const auto &a : e.context.attributes)
      attrs.emplace_back(a.key, a.value);
    if (const auto *s = std::get_if<tracingcore::SpanData>(&e.data)) {
      SpanOutcome outcome = SpanOutcome::SUCCESS;
      switch (s->outcome) {
      case tracingcore::Outcome::Success:
        break;
      case tracingcore::Outcome::Error:
        outcome = SpanOutcome::ERROR;
        break;
      case tracingcore::Outcome::Cancelled:
        outcome = SpanOutcome::CANCELLED;
        break;
      case tracingcore::Outcome::Interrupted:
        outcome = SpanOutcome::INTERRUPTED;
        break;
      }
      p.spans.emplace_back(s->spanId, s->parentSpanId, s->durationMs, outcome, e.sequence, e.timestampMs,
                           e.context.name, e.context.correlationId, attrs);
    } else if (const auto *m = std::get_if<tracingcore::MetricData>(&e.data))
      p.metrics.emplace_back(m->value, m->unit, e.sequence, e.timestampMs, e.context.name, e.context.correlationId,
                             attrs);
    else
      p.marks.emplace_back(e.sequence, e.timestampMs, e.context.name, e.context.correlationId, attrs);
  }
  return p;
}
} // namespace margelo::nitro::nitrotracing
