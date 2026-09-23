#pragma once
#include "HybridTraceSpanSpec.hpp"
#include "core/Recorder.hpp"
namespace margelo::nitro::nitrotracing {
class HybridTraceSpan final : public HybridTraceSpanSpec {
public:
  HybridTraceSpan(std::shared_ptr<tracingcore::Recorder> recorder, uint64_t token);
  std::string getSpanId() override;
  bool getRecorded() override;
  void end(SpanOutcome outcome) override;
  void dispose() override;

private:
  std::shared_ptr<tracingcore::Recorder> recorder_;
  uint64_t token_;
};
} // namespace margelo::nitro::nitrotracing
