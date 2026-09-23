#pragma once
#include "TraceTypes.hpp"
#include <deque>
#include <functional>
#include <map>
#include <mutex>
#include <optional>
namespace margelo::nitro::tracingcore {
// A native API independent of JSI; native workers may share this recorder directly.
class Recorder final {
public:
  using Clock = std::function<double()>;
  explicit Recorder(Config config, Clock clock = monotonicMilliseconds);
  uint64_t startSpan(Context context, std::string parentSpanId = {});
  std::string recordSpan(Context context, std::string parent, double start, double duration, Outcome outcome,
                         std::string sourceId = {}, std::string sourceParent = {});
  void endSpan(uint64_t token, Outcome outcome);
  void mark(Context context, std::optional<double> timestamp = {});
  void metric(Context context, double value, std::string unit, std::optional<double> timestamp = {});
  Page read(uint64_t afterSequence, size_t limit);
  Stats stats();
  Snapshot snapshot();
  void stop();
  void clear();
  std::string spanId(uint64_t token) const;
  size_t memorySize() const;
  static double monotonicMilliseconds();

private:
  struct Active {
    double start;
    Context context;
    std::string parent;
    size_t bytes;
  };
  Config config_;
  Clock clock_;
  double origin_;
  double wallOrigin_;
  std::string sessionId_;
  // Protects mutable state shared by JS calls, native producers and snapshot workers.
  mutable std::mutex mutex_;
  std::map<uint64_t, Active> active_;
  std::deque<Event> events_;
  size_t bytes_ = 0;
  uint64_t token_ = 0, sequence_ = 0, dropped_ = 0;
  bool recording_ = true;
  double now() const;
  void requireRecording() const;
  void expire(double time);
  void finish(std::map<uint64_t, Active>::iterator it, Outcome outcome, double time);
  void append(Event event);
  bool reserve(size_t bytes);
  void evict();
  Stats statsAt(double time) const;
};
} // namespace margelo::nitro::tracingcore
