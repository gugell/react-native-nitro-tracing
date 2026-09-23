#include "Recorder.hpp"
#include "Retention.hpp"
#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <stdexcept>
namespace margelo::nitro::tracingcore {
namespace {
std::atomic<uint64_t> nextSession{0};
}
double Recorder::monotonicMilliseconds() {
  return std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now().time_since_epoch()).count();
}
Recorder::Recorder(Config c, Clock clock)
    : config_(c), clock_(std::move(clock)), origin_(clock_()),
      wallOrigin_(
          std::chrono::duration<double, std::milli>(std::chrono::system_clock::now().time_since_epoch()).count()),
      sessionId_(std::to_string(static_cast<uint64_t>(wallOrigin_)) + "-" + std::to_string(++nextSession)) {
  if (c.maxEvents < 1 || c.maxEvents > 100000 || c.maxBytes < 1024 || c.maxBytes > 67108864 || c.maxActiveSpans < 1 ||
      c.maxActiveSpans > 10000 || !std::isfinite(c.spanTimeoutMs) || c.spanTimeoutMs < 1)
    throw std::invalid_argument("Invalid recording limits: events 1..100000, bytes 1024..67108864, active spans "
                                "1..10000, finite timeout >=1ms");
}
double Recorder::now() const { return clock_() - origin_; }
void Recorder::requireRecording() const {
  if (!recording_)
    throw std::runtime_error("Recording has stopped");
}
std::string Recorder::spanId(uint64_t token) const {
  return token == 0 ? "" : sessionId_ + ":" + std::to_string(token);
}
void Recorder::evict() {
  bytes_ -= eventBytes(events_.front());
  events_.pop_front();
  ++dropped_;
}
bool Recorder::reserve(size_t bytes) {
  while (!events_.empty() && bytes_ + bytes > config_.maxBytes)
    evict();
  return bytes_ + bytes <= config_.maxBytes;
}
void Recorder::append(Event e) {
  e.sequence = ++sequence_;
  const auto size = eventBytes(e);
  if (size > config_.maxBytes) {
    ++dropped_;
    return;
  }
  while (!events_.empty() && events_.size() >= config_.maxEvents)
    evict();
  if (!reserve(size)) {
    ++dropped_;
    return;
  }
  bytes_ += size;
  events_.push_back(std::move(e));
}
uint64_t Recorder::startSpan(Context c, std::string parent) {
  validateContext(c);
  if (parent.size() > sessionId_.size() + 8 + 128 || (!parent.empty() && parent.rfind(sessionId_ + ":", 0) != 0))
    throw std::invalid_argument("Parent span must belong to this recording");
  std::lock_guard lock(mutex_);
  requireRecording();
  const double time = now();
  expire(time);
  const size_t size = sizeof(Active) + contextBytes(c) + parent.capacity() + 64;
  if (active_.size() >= config_.maxActiveSpans || size > config_.maxBytes || !reserve(size)) {
    ++dropped_;
    return 0;
  }
  const auto token = ++token_;
  active_.emplace(token, Active{time, std::move(c), std::move(parent), size});
  bytes_ += size;
  return token;
}
void Recorder::finish(std::map<uint64_t, Active>::iterator it, Outcome outcome, double time) {
  auto active = std::move(it->second);
  const auto token = it->first;
  bytes_ -= active.bytes;
  active_.erase(it);
  append(Event{0, active.start, std::move(active.context),
               SpanData{spanId(token), std::move(active.parent), time - active.start, outcome}});
}
void Recorder::expire(double time) {
  while (!active_.empty() && time - active_.begin()->second.start >= config_.spanTimeoutMs)
    finish(active_.begin(), Outcome::Interrupted, active_.begin()->second.start + config_.spanTimeoutMs);
}
std::string Recorder::recordSpan(Context c, std::string parent, double start, double duration, Outcome outcome,
                                 std::string sourceId, std::string sourceParent) {
  validateContext(c);
  if (!std::isfinite(start) || start < 0 || !std::isfinite(duration) || duration < 0 ||
      !std::isfinite(start + duration))
    throw std::invalid_argument("Imported span requires finite nonnegative start and duration");
  if (parent.size() > sessionId_.size() + 8 + 128 || (!parent.empty() && parent.rfind(sessionId_ + ":", 0) != 0))
    throw std::invalid_argument("Parent span must belong to this recording");
  std::lock_guard lock(mutex_);
  requireRecording();
  expire(now());
  if (sourceId.size() > 128 || sourceParent.size() > 128 || (!sourceParent.empty() && sourceId.empty()))
    throw std::invalid_argument("Source span IDs must be <=128 bytes and a source parent requires a source ID");
  const auto id = sourceId.empty() ? spanId(++token_) : sessionId_ + ":source:" + sourceId;
  if (!sourceParent.empty())
    parent = sessionId_ + ":source:" + sourceParent;
  append(Event{0, start, std::move(c), SpanData{id, std::move(parent), duration, outcome}});
  return id;
}
void Recorder::endSpan(uint64_t token, Outcome outcome) {
  if (token == 0)
    return;
  std::lock_guard lock(mutex_);
  const double time = now();
  expire(time);
  auto it = active_.find(token);
  if (it != active_.end())
    finish(it, outcome, time);
}
void Recorder::mark(Context c, std::optional<double> timestamp) {
  if (timestamp && (!std::isfinite(*timestamp) || *timestamp < 0))
    throw std::invalid_argument("Mark timestamp must be finite and nonnegative");
  validateContext(c);
  std::lock_guard lock(mutex_);
  requireRecording();
  const double time = now();
  expire(time);
  append(Event{0, timestamp.value_or(time), std::move(c), MarkData{}});
}
void Recorder::metric(Context c, double value, std::string unit, std::optional<double> timestamp) {
  if (timestamp && (!std::isfinite(*timestamp) || *timestamp < 0))
    throw std::invalid_argument("Metric timestamp must be finite and nonnegative");
  validateContext(c);
  if (!std::isfinite(value) || unit.empty() || unit.size() > 64)
    throw std::invalid_argument("Metric needs finite value and a 1-64 byte unit");
  std::lock_guard lock(mutex_);
  requireRecording();
  const double time = now();
  expire(time);
  append(Event{0, timestamp.value_or(time), std::move(c), MetricData{value, std::move(unit)}});
}
Page Recorder::read(uint64_t after, size_t limit) {
  if (limit < 1 || limit > 1000)
    throw std::invalid_argument("Page limit must be 1..1000");
  std::lock_guard lock(mutex_);
  expire(now());
  Page p{{}, after, events_.empty() ? sequence_ + 1 : events_.front().sequence, dropped_};
  auto it = std::upper_bound(events_.begin(), events_.end(), after,
                             [](uint64_t seq, const Event &event) { return seq < event.sequence; });
  for (; it != events_.end() && p.events.size() < limit; ++it) {
    p.events.push_back(*it);
    p.nextSequence = it->sequence;
  }
  return p;
}
Stats Recorder::statsAt(double time) const {
  return {sessionId_, wallOrigin_, time, recording_, events_.size(), bytes_, dropped_, active_.size()};
}
Stats Recorder::stats() {
  std::lock_guard lock(mutex_);
  const auto time = now();
  expire(time);
  return statsAt(time);
}
Snapshot Recorder::snapshot() {
  std::lock_guard lock(mutex_);
  const auto time = now();
  expire(time);
  return {statsAt(time),
          {std::vector<Event>(events_.begin(), events_.end()), sequence_,
           events_.empty() ? sequence_ + 1 : events_.front().sequence, dropped_}};
}
void Recorder::stop() {
  std::lock_guard lock(mutex_);
  if (!recording_)
    return;
  const auto time = now();
  expire(time);
  recording_ = false;
  while (!active_.empty())
    finish(active_.begin(), Outcome::Interrupted, time);
}
void Recorder::clear() {
  std::lock_guard lock(mutex_);
  recording_ = false;
  active_.clear();
  events_.clear();
  bytes_ = 0;
}
size_t Recorder::memorySize() const {
  std::lock_guard lock(mutex_);
  return sizeof(Recorder) + bytes_;
}
} // namespace margelo::nitro::tracingcore
