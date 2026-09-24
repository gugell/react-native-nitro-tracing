#pragma once

namespace margelo::nitro::nitrotracing {
/**
 * Stops Hermes' process-wide sampling profiler through the Hermes C++ API.
 * Returns false when this build does not link Hermes (the iOS build, where the
 * profiler's own stop works) or when Hermes refuses the call.
 */
bool disableHermesSampling() noexcept;
} // namespace margelo::nitro::nitrotracing
