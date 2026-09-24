#include "TraceJson.hpp"
#include <algorithm>
#include <iomanip>
#include <map>
#include <vector>
#include <locale>
#include <sstream>
namespace margelo::nitro::tracingcore {
namespace {
void quote(std::ostream &o, const std::string &s) {
  constexpr char hex[] = "0123456789abcdef";
  o << '"';
  for (unsigned char c : s) {
    if (c == '"' || c == '\\')
      o << '\\' << c;
    else if (c < 32)
      o << "\\u00" << hex[c >> 4] << hex[c & 15];
    else
      o << c;
  }
  o << '"';
}
const char *outcomeName(Outcome o) {
  switch (o) {
  case Outcome::Success:
    return "success";
  case Outcome::Error:
    return "error";
  case Outcome::Cancelled:
    return "cancelled";
  case Outcome::Interrupted:
    return "interrupted";
  }
  return "unknown";
}
void eventJson(std::ostream &o, const Event &e) {
  o << "{\"sequence\":" << e.sequence << ",\"timestampMs\":" << e.timestampMs << ",\"name\":";
  quote(o, e.context.name);
  o << ",\"correlationId\":";
  quote(o, e.context.correlationId);
  o << ",\"attributes\":[";
  bool comma = false;
  for (const auto &a : e.context.attributes) {
    if (comma)
      o << ',';
    comma = true;
    o << "{\"key\":";
    quote(o, a.key);
    o << ",\"value\":";
    quote(o, a.value);
    o << '}';
  }
  o << ']';
  if (const auto *s = std::get_if<SpanData>(&e.data)) {
    o << ",\"kind\":\"span\",\"spanId\":";
    quote(o, s->spanId);
    o << ",\"parentSpanId\":";
    quote(o, s->parentSpanId);
    o << ",\"durationMs\":" << s->durationMs << ",\"outcome\":";
    quote(o, outcomeName(s->outcome));
  } else if (const auto *m = std::get_if<MetricData>(&e.data)) {
    o << ",\"kind\":\"metric\",\"value\":" << m->value << ",\"unit\":";
    quote(o, m->unit);
  } else
    o << ",\"kind\":\"mark\"";
  o << '}';
}
const std::string &sourceOf(const Event &e) {
  static const std::string fallback = "app";
  for (const auto &a : e.context.attributes)
    if (a.key == "source" && !a.value.empty())
      return a.value;
  return fallback;
}
void argsJson(std::ostream &o, const Event &e) {
  o << "\"args\":{\"correlationId\":";
  quote(o, e.context.correlationId);
  for (const auto &a : e.context.attributes) {
    o << ',';
    quote(o, a.key);
    o << ':';
    quote(o, a.value);
  }
  if (const auto *s = std::get_if<SpanData>(&e.data)) {
    o << ",\"outcome\":";
    quote(o, outcomeName(s->outcome));
    o << ",\"spanId\":";
    quote(o, s->spanId);
    o << ",\"parentSpanId\":";
    quote(o, s->parentSpanId);
  }
  o << '}';
}
/**
 * Lanes per source where spans either nest or follow each other. Perfetto requires strict
 * nesting of complete events on one thread, so overlapping siblings get another lane.
 */
class Lanes {
public:
  int place(const std::string &source, double start, double end) {
    auto &lanes = bySource_[source];
    for (auto &lane : lanes) {
      while (!lane.open.empty() && lane.open.back() <= start)
        lane.open.pop_back();
      if (lane.open.empty() || end <= lane.open.back()) {
        lane.open.push_back(end);
        return lane.tid;
      }
    }
    lanes.push_back({next_++, {end}});
    names_.emplace_back(lanes.back().tid, lanes.size() == 1 ? source : source + " #" + std::to_string(lanes.size()));
    return lanes.back().tid;
  }
  int first(const std::string &source) {
    auto &lanes = bySource_[source];
    if (lanes.empty()) {
      lanes.push_back({next_++, {}});
      names_.emplace_back(lanes.back().tid, source);
    }
    return lanes.front().tid;
  }
  const std::vector<std::pair<int, std::string>> &names() const { return names_; }

private:
  struct Lane {
    int tid;
    std::vector<double> open;
  };
  std::map<std::string, std::vector<Lane>> bySource_;
  std::vector<std::pair<int, std::string>> names_;
  int next_ = 1;
};
} // namespace
std::string exportTraceEvents(const Snapshot &s) {
  std::vector<const Event *> events;
  for (const auto &e : s.page.events)
    events.push_back(&e);
  const auto duration = [](const Event *e) {
    const auto *span = std::get_if<SpanData>(&e->data);
    return span ? span->durationMs : 0;
  };
  // Parents before children: earlier start first, longer span first on ties.
  std::stable_sort(events.begin(), events.end(), [&](const Event *a, const Event *b) {
    return a->timestampMs != b->timestampMs ? a->timestampMs < b->timestampMs : duration(a) > duration(b);
  });
  std::ostringstream body;
  body.imbue(std::locale::classic());
  body << std::setprecision(17);
  Lanes lanes;
  for (const auto *e : events) {
    const auto &source = sourceOf(*e);
    const double ts = e->timestampMs * 1000; // Trace Event timestamps are microseconds.
    body << ",{\"pid\":1,\"name\":";
    if (const auto *span = std::get_if<SpanData>(&e->data)) {
      quote(body, e->context.name);
      body << ",\"cat\":";
      quote(body, source);
      body << ",\"ph\":\"X\",\"ts\":" << ts << ",\"dur\":" << span->durationMs * 1000
           << ",\"tid\":" << lanes.place(source, e->timestampMs, e->timestampMs + span->durationMs) << ',';
    } else if (const auto *metric = std::get_if<MetricData>(&e->data)) {
      // Counter tracks are keyed by name, so the unit is part of it.
      quote(body, e->context.name + " (" + metric->unit + ")");
      body << ",\"cat\":";
      quote(body, source);
      body << ",\"ph\":\"C\",\"ts\":" << ts << ",\"args\":{\"value\":" << metric->value << "}}";
      continue;
    } else {
      quote(body, e->context.name);
      body << ",\"cat\":";
      quote(body, source);
      body << ",\"ph\":\"i\",\"s\":\"t\",\"ts\":" << ts << ",\"tid\":" << lanes.first(source) << ',';
    }
    argsJson(body, *e);
    body << '}';
  }
  std::ostringstream o;
  o.imbue(std::locale::classic());
  o << std::setprecision(17);
  o << "{\"displayTimeUnit\":\"ms\",\"otherData\":{\"generator\":\"react-native-nitro-tracing\",\"sessionId\":";
  quote(o, s.stats.sessionId);
  o << ",\"startedAtUnixMs\":" << s.stats.startedAtUnixMs << ",\"droppedEvents\":" << s.stats.droppedEvents
    << "},\"traceEvents\":[{\"pid\":1,\"ph\":\"M\",\"name\":\"process_name\",\"args\":{\"name\":\"React Native app\"}}";
  for (const auto &[tid, name] : lanes.names()) {
    o << ",{\"pid\":1,\"tid\":" << tid << ",\"ph\":\"M\",\"name\":\"thread_name\",\"args\":{\"name\":";
    quote(o, name);
    o << "}},{\"pid\":1,\"tid\":" << tid
      << ",\"ph\":\"M\",\"name\":\"thread_sort_index\",\"args\":{\"sort_index\":" << tid << "}}";
  }
  o << body.str() << "]}";
  return o.str();
}
std::string exportJson(const Snapshot &s) {
  std::ostringstream o;
  o.imbue(std::locale::classic());
  o << std::setprecision(17);
  o << "{\"schemaVersion\":1,\"sessionId\":";
  quote(o, s.stats.sessionId);
  o << ",\"startedAtUnixMs\":" << s.stats.startedAtUnixMs << ",\"recording\":" << (s.stats.recording ? "true" : "false")
    << ",\"activeSpans\":" << s.stats.activeSpans << ",\"droppedEvents\":" << s.stats.droppedEvents
    << ",\"earliestSequence\":" << s.page.earliestSequence << ",\"events\":[";
  bool comma = false;
  for (const auto &e : s.page.events) {
    if (comma)
      o << ',';
    comma = true;
    eventJson(o, e);
  }
  o << "]}";
  return o.str();
}
} // namespace margelo::nitro::tracingcore
