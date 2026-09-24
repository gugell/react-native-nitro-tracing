#pragma once
#include "Recorder.hpp"
#include <condition_variable>
#include <functional>
#include <memory>
#include <mutex>
#include <thread>
namespace margelo::nitro::tracingcore {
/** Aggregates main-thread frame callbacks between sampler windows. Process-wide. */
class FrameMonitor final {
public:
  struct Window {
    uint64_t frames = 0, slow = 0, frozen = 0;
    double maxGapMs = 0, intervalMs = 0;
  };
  static FrameMonitor &instance();
  /** Platform layer: start/stop display callbacks on the main thread. */
  void setToggle(std::function<void(bool)> toggle);
  /** Reference-counted so concurrent recordings share one callback source. */
  bool acquire();
  void release();
  /** Seconds on a monotonic clock; expected frame interval, or 0 to infer it. */
  void onFrame(double timestampSeconds, double expectedIntervalSeconds);
  Window take();

private:
  std::mutex mutex_;
  std::function<void(bool)> toggle_;
  int users_ = 0;
  double last_ = 0, minGap_ = 0;
  Window window_;
};

/** Background thread writing CPU, memory and frame windows into a recorder. */
class NativeSampler final {
public:
  NativeSampler(std::shared_ptr<Recorder> recorder, double intervalMs, bool frames);
  ~NativeSampler();
  NativeSampler(const NativeSampler &) = delete;
  NativeSampler &operator=(const NativeSampler &) = delete;
  /** CPU time used by this process across all threads, in milliseconds. */
  static double processCpuMs();
  /** iOS physical footprint or Android/Linux resident set, in bytes; 0 when unavailable. */
  static double processMemoryBytes();

private:
  void run();
  std::shared_ptr<Recorder> recorder_;
  double intervalMs_;
  bool frames_;
  std::mutex mutex_;
  std::condition_variable wake_;
  bool stopping_ = false;
  std::thread thread_;
};
} // namespace margelo::nitro::tracingcore
