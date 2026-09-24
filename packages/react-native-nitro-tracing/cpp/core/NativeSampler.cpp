#include "NativeSampler.hpp"
#include <algorithm>
#include <cstdio>
#include <sys/resource.h>
#include <unistd.h>
#if defined(__APPLE__)
#include <mach/mach.h>
#endif
namespace margelo::nitro::tracingcore {
namespace {
// A frame taking 1.5x the display interval missed at least one deadline.
constexpr double slowFactor = 1.5;
// Android vitals and Sentry both treat >= 700 ms as a frozen frame.
constexpr double frozenMs = 700;
} // namespace

FrameMonitor &FrameMonitor::instance() {
  static FrameMonitor monitor;
  return monitor;
}
void FrameMonitor::setToggle(std::function<void(bool)> toggle) {
  std::lock_guard lock(mutex_);
  toggle_ = std::move(toggle);
}
bool FrameMonitor::acquire() {
  std::function<void(bool)> toggle;
  {
    std::lock_guard lock(mutex_);
    if (!toggle_)
      return false;
    if (users_++ == 0) {
      last_ = 0;
      window_ = {};
      toggle = toggle_;
    }
  }
  if (toggle)
    toggle(true);
  return true;
}
void FrameMonitor::release() {
  std::function<void(bool)> toggle;
  {
    std::lock_guard lock(mutex_);
    if (users_ > 0 && --users_ == 0)
      toggle = toggle_;
  }
  if (toggle)
    toggle(false);
}
void FrameMonitor::onFrame(double timestamp, double expected) {
  std::lock_guard lock(mutex_);
  if (last_ > 0 && timestamp > last_) {
    const double gapMs = (timestamp - last_) * 1000;
    // Without a platform interval, the shortest recent gap approximates the vsync period.
    if (expected <= 0)
      minGap_ = minGap_ <= 0 ? gapMs : std::min(minGap_, gapMs);
    const double intervalMs = expected > 0 ? expected * 1000 : minGap_;
    ++window_.frames;
    window_.intervalMs = intervalMs;
    window_.maxGapMs = std::max(window_.maxGapMs, gapMs);
    if (gapMs >= frozenMs)
      ++window_.frozen;
    else if (intervalMs > 0 && gapMs > intervalMs * slowFactor)
      ++window_.slow;
  }
  last_ = timestamp;
}
FrameMonitor::Window FrameMonitor::take() {
  std::lock_guard lock(mutex_);
  const auto window = window_;
  window_ = {};
  return window;
}

double NativeSampler::processCpuMs() {
  rusage usage{};
  if (getrusage(RUSAGE_SELF, &usage) != 0)
    return 0;
  const auto ms = [](timeval t) { return t.tv_sec * 1000.0 + t.tv_usec / 1000.0; };
  return ms(usage.ru_utime) + ms(usage.ru_stime);
}
double NativeSampler::processMemoryBytes() {
#if defined(__APPLE__)
  task_vm_info_data_t info{};
  mach_msg_type_number_t count = TASK_VM_INFO_COUNT;
  if (task_info(mach_task_self(), TASK_VM_INFO, reinterpret_cast<task_info_t>(&info), &count) == KERN_SUCCESS)
    return static_cast<double>(info.phys_footprint);
  return 0;
#else
  long pages = 0, resident = 0;
  FILE *file = std::fopen("/proc/self/statm", "r");
  if (!file)
    return 0;
  const bool read = std::fscanf(file, "%ld %ld", &pages, &resident) == 2;
  std::fclose(file);
  return read ? static_cast<double>(resident) * static_cast<double>(sysconf(_SC_PAGESIZE)) : 0;
#endif
}

NativeSampler::NativeSampler(std::shared_ptr<Recorder> recorder, double intervalMs, bool frames)
    : recorder_(std::move(recorder)), intervalMs_(intervalMs),
      frames_(frames && FrameMonitor::instance().acquire()), thread_([this] { run(); }) {}
NativeSampler::~NativeSampler() {
  {
    std::lock_guard lock(mutex_);
    stopping_ = true;
  }
  wake_.notify_all();
  thread_.join();
  if (frames_)
    FrameMonitor::instance().release();
}
void NativeSampler::run() {
  double lastWall = Recorder::monotonicMilliseconds();
  double lastCpu = processCpuMs();
  if (frames_)
    FrameMonitor::instance().take(); // Discard frames from before this window.
  std::unique_lock lock(mutex_);
  while (!wake_.wait_for(lock, std::chrono::duration<double, std::milli>(intervalMs_), [this] { return stopping_; })) {
    lock.unlock();
    const double wall = Recorder::monotonicMilliseconds();
    const double cpu = processCpuMs();
    const double windowMs = wall - lastWall;
    const auto context = [&](const char *name) {
      return Context{name, "", {{"source", "native"}, {"windowMs", std::to_string(static_cast<int>(windowMs))}}};
    };
    try {
      if (windowMs > 0)
        // Percent of one core: a busy multi-threaded process can exceed 100.
        recorder_->metric(context("process.cpu"), std::max(0.0, (cpu - lastCpu) / windowMs * 100), "%");
      if (const double memory = processMemoryBytes(); memory > 0)
        recorder_->metric(context("process.memory"), memory / (1024 * 1024), "MB");
      if (frames_) {
        const auto w = FrameMonitor::instance().take();
        // Paused display callbacks (background, locked screen) produce no frames: report nothing.
        if (w.frames > 1 && windowMs > 0) {
          recorder_->metric(context("ui.fps"), w.frames * 1000 / windowMs, "fps");
          recorder_->metric(context("ui.frame_gap.max"), w.maxGapMs, "ms");
          recorder_->metric(context("ui.frames.slow"), static_cast<double>(w.slow), "count");
          recorder_->metric(context("ui.frames.frozen"), static_cast<double>(w.frozen), "count");
        }
      }
    } catch (...) {
      return; // Recording stopped or was cleared; the owner joins this thread.
    }
    lastWall = wall;
    lastCpu = cpu;
    lock.lock();
  }
}
} // namespace margelo::nitro::tracingcore
