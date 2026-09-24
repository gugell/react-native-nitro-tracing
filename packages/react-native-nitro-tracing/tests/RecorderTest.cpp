#include "Recorder.hpp"
#include "NativeSampler.hpp"
#include "TraceJson.hpp"
#include <cassert>
#include <iostream>
#include <limits>
#include <thread>
using namespace margelo::nitro::tracingcore;
Context ctx(std::string name = "upload") { return {name, "job", {{"safe", "value"}}}; }
int main() {
  {
    // Metric samples fill at most half the buffer; the rest stays for spans and marks.
    Recorder mixed({10, 1024 * 1024, 10, 1000});
    for (int i = 0; i < 4; ++i)
      mixed.mark(ctx());
    for (int i = 0; i < 50; ++i)
      mixed.metric(ctx(), i, "count");
    auto page = mixed.read(0, 100);
    size_t marks = 0, metrics = 0;
    for (auto &e : page.events)
      std::holds_alternative<MarkData>(e.data) ? ++marks : ++metrics;
    assert(marks == 4 && metrics == 5);
    assert(std::get<MetricData>(page.events.back().data).value == 49);
    assert(page.droppedEvents == 0); // rolled samples are not lost history
  }
  double clock = 100;
  Recorder r({100, 1024 * 1024, 10, 1000}, [&] { return clock; });
  auto a = r.startSpan(ctx());
  clock += 10;
  auto b = r.startSpan(ctx(), r.spanId(a));
  clock += 5;
  r.endSpan(b, Outcome::Error);
  clock += 5;
  r.endSpan(a, Outcome::Success);
  r.endSpan(a, Outcome::Error);
  auto p = r.read(0, 100);
  assert(p.events.size() == 2);
  auto sa = std::get<SpanData>(p.events[1].data);
  auto sb = std::get<SpanData>(p.events[0].data);
  assert(sa.durationMs == 20 && sb.durationMs == 5 && sa.spanId != sb.spanId && sb.parentSpanId == sa.spanId);
  r.mark(ctx("quote\"\n"));
  r.metric(ctx(), 42, "byte/second");
  assert(r.read(2, 1).events.size() == 1);
  auto json = exportJson(r.snapshot());
  assert(json.find("quote\\\"\\u000a") != std::string::npos);
  bool invalid = false;
  try {
    r.metric(ctx(), std::numeric_limits<double>::quiet_NaN(), "count");
  } catch (...) {
    invalid = true;
  }
  assert(invalid);
  auto open = r.startSpan(ctx());
  r.stop();
  r.stop();
  r.endSpan(open, Outcome::Success);
  assert(!r.stats().recording && r.stats().activeSpans == 0);
  invalid = false;
  try {
    r.mark(ctx());
  } catch (...) {
    invalid = true;
  }
  assert(invalid);
  Recorder imported({100, 1024 * 1024, 10, 1000}, [&] { return clock; });
  auto childId = imported.recordSpan(ctx(), "", 2, 3, Outcome::Success, "sentry:child", "sentry:parent");
  auto parentId = imported.recordSpan(ctx(), "", 0, 10, Outcome::Success, "sentry:parent");
  imported.mark(ctx(), 1);
  imported.metric(ctx(), 5, "count", 2);
  const auto importedPage = imported.read(0, 100);
  assert(std::get<SpanData>(importedPage.events[0].data).parentSpanId == parentId && childId != parentId);
  assert(importedPage.events[2].timestampMs == 1 && importedPage.events[3].timestampMs == 2);
  const auto longestParent = imported.recordSpan(ctx(), "", 0, 1, Outcome::Success, std::string(128, 'x'));
  const auto linked = imported.startSpan(ctx(), longestParent);
  imported.endSpan(linked, Outcome::Success);
  imported.recordSpan(ctx(), longestParent, 1, 1, Outcome::Success);
  assert(std::get<SpanData>(imported.read(0, 100).events.back().data).parentSpanId == longestParent);
  Recorder tiny({2, 2048, 1, 5}, [&] { return clock; });
  auto token = tiny.startSpan(ctx());
  assert(token != 0 && tiny.startSpan(ctx()) == 0);
  clock += 6;
  assert(tiny.stats().activeSpans == 0);
  tiny.mark(ctx());
  tiny.mark(ctx());
  assert(tiny.stats().eventCount == 2 && tiny.stats().droppedEvents >= 2);
  assert(tiny.read(0, 100).earliestSequence > 1 && tiny.stats().retainedBytes <= 2048);
  tiny.clear();
  assert(tiny.memorySize() >= sizeof(Recorder) && tiny.stats().retainedBytes == 0);
  Recorder concurrent({100000, 32 * 1024 * 1024, 100, 10000});
  std::vector<std::thread> workers;
  for (int i = 0; i < 4; ++i)
    workers.emplace_back([&] {
      for (int j = 0; j < 1000; ++j) {
        auto t = concurrent.startSpan(ctx());
        concurrent.endSpan(t, Outcome::Success);
      }
    });
  for (auto &t : workers)
    t.join();
  assert(concurrent.stats().eventCount == 4000 && concurrent.stats().activeSpans == 0);
  std::cout << "Recorder behavior and concurrency checks passed\n";
  const auto start = Recorder::monotonicMilliseconds();
  for (int i = 0; i < 10000; ++i) {
    auto t = concurrent.startSpan(ctx());
    concurrent.endSpan(t, Outcome::Success);
  }
  std::cout << "Host 10000 span pairs: " << Recorder::monotonicMilliseconds() - start << "ms\n";
  std::cout << json << '\n';

  // Trace Event export: overlapping siblings get separate lanes, nested spans share one.
  double t = 0;
  Recorder lanes({100, 1024 * 1024, 10, 1000}, [&] { return t; });
  const Context net{"GET /a", "", {{"source", "network"}}};
  lanes.recordSpan(net, "", 0, 100, Outcome::Success);
  lanes.recordSpan(net, "", 50, 100, Outcome::Error); // overlaps the first: second lane
  lanes.recordSpan({"parent", "", {}}, "", 0, 100, Outcome::Success);
  lanes.recordSpan({"child", "", {}}, "", 10, 20, Outcome::Success); // nested: same lane
  lanes.metric({"process.memory", "", {{"source", "native"}}}, 42.5, "MB");
  const auto trace = exportTraceEvents(lanes.snapshot());
  assert(trace.find("\"traceEvents\":[") != std::string::npos);
  assert(trace.find("\"name\":\"network #2\"") != std::string::npos);
  assert(trace.find("\"name\":\"app #2\"") == std::string::npos);
  assert(trace.find("\"name\":\"process.memory (MB)\",\"cat\":\"native\",\"ph\":\"C\"") != std::string::npos);
  assert(trace.find("\"ts\":50000,\"dur\":100000") != std::string::npos);

  // Frame windows: explicit 16.7 ms interval, one slow (40 ms) and one frozen (800 ms) gap.
  auto &frames = FrameMonitor::instance();
  bool enabled = false;
  frames.setToggle([&](bool on) { enabled = on; });
  assert(frames.acquire() && enabled);
  const double v = 1.0 / 60;
  for (double at : {1.0, 1.0 + v, 1.0 + 2 * v, 1.0 + 2 * v + 0.040, 1.0 + 2 * v + 0.840})
    frames.onFrame(at, v);
  const auto window = frames.take();
  assert(window.frames == 4 && window.slow == 1 && window.frozen == 1 && window.maxGapMs > 799);
  assert(frames.take().frames == 0);
  frames.release();
  assert(!enabled);

  // Sampler thread writes process metrics and stops cleanly with its recording.
  auto sampled = std::make_shared<Recorder>(Config{100, 1024 * 1024, 10, 1000});
  {
    NativeSampler sampler(sampled, 20, false);
    std::this_thread::sleep_for(std::chrono::milliseconds(70));
  }
  const auto samples = sampled->read(0, 100).events;
  assert(samples.size() >= 2 && samples[0].context.name == "process.cpu");
  assert(NativeSampler::processMemoryBytes() > 0 && NativeSampler::processCpuMs() > 0);
  std::cout << "Trace export, frame window and sampler checks passed\n";
}
