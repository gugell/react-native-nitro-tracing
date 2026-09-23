#pragma once
#include "HybridTracingSpec.hpp"
namespace margelo::nitro::nitrotracing {
class HybridTracing final : public HybridTracingSpec {
 public:
  HybridTracing():HybridObject(TAG){}
  std::shared_ptr<HybridRecordingSpec> startRecording(const RecordingOptions& options) override;
};
}
