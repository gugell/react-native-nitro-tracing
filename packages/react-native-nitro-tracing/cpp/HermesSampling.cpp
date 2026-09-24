#include "HermesSampling.hpp"

#if defined(NITRO_TRACING_HERMES)
#include <hermes/hermes.h>
#endif

namespace margelo::nitro::nitrotracing {
bool disableHermesSampling() noexcept {
#if defined(NITRO_TRACING_HERMES)
  // React Native 0.85's HermesSamplingProfiler binds its Java disable() to the native
  // enable(), so on Android "stop profiling" leaves the sampler running. This is the call
  // the binding should have made.
  try {
    auto *api = facebook::jsi::castInterface<facebook::hermes::IHermesRootAPI>(facebook::hermes::makeHermesRootAPI());
    if (api == nullptr)
      return false;
    api->disableSamplingProfiler();
    return true;
  } catch (...) {
    return false;
  }
#else
  return false;
#endif
}
} // namespace margelo::nitro::nitrotracing
