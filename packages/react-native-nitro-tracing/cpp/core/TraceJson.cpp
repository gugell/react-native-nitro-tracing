#include "TraceJson.hpp"
#include <iomanip>
#include <locale>
#include <sstream>
namespace margelo::nitro::tracingcore {
namespace {
void quote(std::ostream& o, const std::string& s) {
  constexpr char hex[] = "0123456789abcdef"; o << '"';
  for (unsigned char c : s) {
    if (c == '"' || c == '\\') o << '\\' << c;
    else if (c < 32) o << "\\u00" << hex[c >> 4] << hex[c & 15];
    else o << c;
  }
  o << '"';
}
const char* outcomeName(Outcome o) {
  switch(o) { case Outcome::Success: return "success"; case Outcome::Error: return "error"; case Outcome::Cancelled: return "cancelled"; case Outcome::Interrupted: return "interrupted"; }
}
void eventJson(std::ostream& o, const Event& e) {
  o << "{\"sequence\":" << e.sequence << ",\"timestampMs\":" << e.timestampMs << ",\"name\":"; quote(o,e.context.name);
  o << ",\"correlationId\":"; quote(o,e.context.correlationId);
  o << ",\"attributes\":["; bool comma = false;
  for (const auto& a : e.context.attributes) { if (comma) o << ','; comma = true; o << "{\"key\":"; quote(o,a.key); o << ",\"value\":"; quote(o,a.value); o << '}'; }
  o << ']';
  if (const auto* s = std::get_if<SpanData>(&e.data)) {
    o << ",\"kind\":\"span\",\"spanId\":"; quote(o,s->spanId); o << ",\"parentSpanId\":"; quote(o,s->parentSpanId);
    o << ",\"durationMs\":" << s->durationMs << ",\"outcome\":"; quote(o,outcomeName(s->outcome));
  } else if (const auto* m = std::get_if<MetricData>(&e.data)) {
    o << ",\"kind\":\"metric\",\"value\":" << m->value << ",\"unit\":"; quote(o,m->unit);
  } else o << ",\"kind\":\"mark\"";
  o << '}';
}
}
std::string exportJson(const Snapshot& s) {
  std::ostringstream o; o.imbue(std::locale::classic()); o << std::setprecision(17);
  o << "{\"schemaVersion\":1,\"sessionId\":"; quote(o,s.stats.sessionId);
  o << ",\"startedAtUnixMs\":" << s.stats.startedAtUnixMs << ",\"recording\":" << (s.stats.recording ? "true" : "false")
    << ",\"activeSpans\":" << s.stats.activeSpans << ",\"droppedEvents\":" << s.stats.droppedEvents
    << ",\"earliestSequence\":" << s.page.earliestSequence << ",\"events\":[";
  bool comma = false; for (const auto& e : s.page.events) { if (comma) o << ','; comma = true; eventJson(o,e); }
  o << "]}"; return o.str();
}
}
