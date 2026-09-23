#include "Recorder.hpp"
#include "TraceJson.hpp"
#include <cassert>
#include <iostream>
#include <limits>
#include <thread>
using namespace margelo::nitro::tracingcore;
Context ctx(std::string name = "upload") { return {name, "job", {{"safe", "value"}}}; }
int main() {
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
}
