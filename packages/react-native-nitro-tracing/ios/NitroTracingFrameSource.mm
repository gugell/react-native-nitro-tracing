#import <QuartzCore/QuartzCore.h>
#import <UIKit/UIKit.h>
#include "../cpp/core/NativeSampler.hpp"

using margelo::nitro::tracingcore::FrameMonitor;

/// Main run loop display callbacks. A callback delayed past its vsync means the main thread
/// was busy; FrameMonitor turns those gaps into slow and frozen frame counts.
@interface NitroTracingFrameSource : NSObject
@property(nonatomic, strong) CADisplayLink *link;
@end

@implementation NitroTracingFrameSource
- (void)tick:(CADisplayLink *)link {
  // targetTimestamp - timestamp is the current frame interval, including ProMotion rates.
  FrameMonitor::instance().onFrame(link.timestamp, link.targetTimestamp - link.timestamp);
}
@end

static NitroTracingFrameSource *source;

__attribute__((constructor)) static void NitroTracingRegisterFrameSource() {
  FrameMonitor::instance().setToggle([](bool enabled) {
    dispatch_async(dispatch_get_main_queue(), ^{
      if (enabled && !source) {
        source = [NitroTracingFrameSource new];
        source.link = [CADisplayLink displayLinkWithTarget:source selector:@selector(tick:)];
        [source.link addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
      } else if (!enabled && source) {
        [source.link invalidate];
        source = nil;
      }
    });
  });
}
