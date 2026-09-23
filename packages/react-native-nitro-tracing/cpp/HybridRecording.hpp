#pragma once
#include "HybridRecordingSpec.hpp"
#include "core/Recorder.hpp"
namespace margelo::nitro::nitrotracing {
class HybridRecording final : public HybridRecordingSpec {
public:
  explicit HybridRecording(tracingcore::Config config);
  ~HybridRecording() override;
  std::shared_ptr<HybridTraceSpanSpec> startSpan(const SpanOptions &options) override;
  std::string recordSpan(const CompletedSpanOptions &options) override;
  void mark(const MarkOptions &options) override;
  void recordMetric(const MetricOptions &options) override;
  std::shared_ptr<Promise<TracePage>> readEvents(const ReadOptions &options) override;
  RecordingStats getStats() override;
  void stop() override;
  std::shared_ptr<Promise<std::string>> exportJson() override;
  size_t getExternalMemorySize() noexcept override;
  void dispose() override;

private:
  std::shared_ptr<tracingcore::Recorder> recorder_;
};
} // namespace margelo::nitro::nitrotracing
