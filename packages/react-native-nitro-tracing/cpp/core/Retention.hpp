#pragma once
#include "TraceTypes.hpp"
namespace margelo::nitro::tracingcore {
void validateContext(const Context &context);
size_t contextBytes(const Context &context);
size_t eventBytes(const Event &event);
} // namespace margelo::nitro::tracingcore
