#include "HybridTracing.hpp"
#include "HybridRecording.hpp"
#include "NativeConversions.hpp"
namespace margelo::nitro::nitrotracing {
std::shared_ptr<HybridRecordingSpec> HybridTracing::startRecording(const RecordingOptions& o){return std::make_shared<HybridRecording>(toCore(o));}
}
