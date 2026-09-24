#include "HybridRecording.hpp"
#include "HybridTraceSpan.hpp"
#include "NativeConversions.hpp"
#include "core/TraceJson.hpp"
#include <cmath>
#include <stdexcept>
namespace margelo::nitro::nitrotracing {
HybridRecording::HybridRecording(tracingcore::Config c)
    : HybridObject(TAG), recorder_(std::make_shared<tracingcore::Recorder>(c)) {}
HybridRecording::~HybridRecording() {
  stopNativeSampling();
  recorder_->stop();
}
std::shared_ptr<HybridTraceSpanSpec> HybridRecording::startSpan(const SpanOptions &o) {
  auto token = recorder_->startSpan(toCore(o.name, o.correlationId, o.attributes), o.parentSpanId.value_or(""));
  return std::make_shared<HybridTraceSpan>(recorder_, token);
}
std::string HybridRecording::recordSpan(const CompletedSpanOptions &o) {
  return recorder_->recordSpan(toCore(o.name, o.correlationId, o.attributes), o.parentSpanId.value_or(""),
                               o.timestampMs, o.durationMs, toCore(o.outcome), o.sourceSpanId.value_or(""),
                               o.sourceParentSpanId.value_or(""));
}
void HybridRecording::mark(const MarkOptions &o) {
  recorder_->mark(toCore(o.name, o.correlationId, o.attributes), o.timestampMs);
}
void HybridRecording::recordMetric(const MetricOptions &o) {
  recorder_->metric(toCore(o.name, o.correlationId, o.attributes), o.value, o.unit, o.timestampMs);
}
std::shared_ptr<Promise<TracePage>> HybridRecording::readEvents(const ReadOptions &o) {
  auto after = checkedInteger(o.afterSequence, 9007199254740991.0, "afterSequence");
  auto limit = checkedInteger(o.limit, 1000, "limit");
  auto recorder = recorder_;
  return Promise<TracePage>::async([recorder, after, limit]() { return toNative(recorder->read(after, limit)); });
}
RecordingStats HybridRecording::getStats() { return toNative(recorder_->stats()); }
void HybridRecording::stop() {
  stopNativeSampling();
  recorder_->stop();
}
std::shared_ptr<Promise<std::string>> HybridRecording::exportJson() {
  auto recorder = recorder_;
  return Promise<std::string>::async([recorder]() { return tracingcore::exportJson(recorder->snapshot()); });
}
size_t HybridRecording::getExternalMemorySize() noexcept { return recorder_->memorySize(); }
void HybridRecording::dispose() {
  stopNativeSampling();
  recorder_->clear();
}
std::shared_ptr<Promise<std::string>> HybridRecording::exportTraceEvents() {
  auto recorder = recorder_;
  return Promise<std::string>::async([recorder]() { return tracingcore::exportTraceEvents(recorder->snapshot()); });
}
void HybridRecording::startNativeSampling(const NativeSamplingOptions &o) {
  if (!std::isfinite(o.intervalMs) || o.intervalMs < 250 || o.intervalMs > 60000)
    throw std::invalid_argument("Native sampling interval must be 250..60000 ms");
  if (!recorder_->stats().recording)
    throw std::runtime_error("Recording has stopped");
  std::lock_guard lock(samplerMutex_);
  sampler_.reset(); // Join the previous thread before starting its replacement.
  sampler_ = std::make_unique<tracingcore::NativeSampler>(recorder_, o.intervalMs, o.frames);
}
void HybridRecording::stopNativeSampling() {
  std::lock_guard lock(samplerMutex_);
  sampler_.reset();
}
} // namespace margelo::nitro::nitrotracing
