#include "HybridTracing.hpp"
#include "HermesSampling.hpp"
#include "HybridRecording.hpp"
#include "NativeConversions.hpp"
namespace margelo::nitro::nitrotracing {
std::shared_ptr<HybridRecordingSpec> HybridTracing::startRecording(const RecordingOptions &o) {
  return std::make_shared<HybridRecording>(toCore(o));
}
bool HybridTracing::disableHermesSampling() { return nitrotracing::disableHermesSampling(); }
} // namespace margelo::nitro::nitrotracing
