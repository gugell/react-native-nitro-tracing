#include "Retention.hpp"
#include <stdexcept>
namespace margelo::nitro::tracingcore {
void validateContext(const Context& c) {
  if (c.name.empty() || c.name.size() > 256 || c.correlationId.size() > 256 || c.attributes.size() > 32)
    throw std::invalid_argument("Trace name must be 1-256 bytes, correlationId <=256 bytes, attributes <=32");
  for (const auto& a : c.attributes)
    if (a.key.empty() || a.key.size() > 64 || a.value.size() > 1024)
      throw std::invalid_argument("Trace attribute key must be 1-64 bytes and value <=1024 bytes");
}
size_t contextBytes(const Context& c) {
  size_t n = sizeof(Context) + c.name.capacity() + c.correlationId.capacity() + c.attributes.capacity() * sizeof(Attribute);
  for (const auto& a : c.attributes) n += a.key.capacity() + a.value.capacity();
  return n;
}
size_t eventBytes(const Event& e) {
  size_t n = sizeof(Event) + contextBytes(e.context);
  if (const auto* s = std::get_if<SpanData>(&e.data)) n += s->spanId.capacity() + s->parentSpanId.capacity();
  if (const auto* m = std::get_if<MetricData>(&e.data)) n += m->unit.capacity();
  return n;
}
}
