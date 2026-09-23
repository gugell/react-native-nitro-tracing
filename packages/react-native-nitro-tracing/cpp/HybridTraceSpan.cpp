#include "HybridTraceSpan.hpp"
#include "NativeConversions.hpp"
namespace margelo::nitro::nitrotracing {
HybridTraceSpan::HybridTraceSpan(std::shared_ptr<tracingcore::Recorder> r,uint64_t t):HybridObject(TAG),recorder_(std::move(r)),token_(t){}
std::string HybridTraceSpan::getSpanId(){return recorder_->spanId(token_);}
bool HybridTraceSpan::getRecorded(){return token_!=0;}
void HybridTraceSpan::end(SpanOutcome outcome){recorder_->endSpan(token_,toCore(outcome));}
void HybridTraceSpan::dispose(){recorder_->endSpan(token_,tracingcore::Outcome::Interrupted);}
}
