#include "HermesSampling.hpp"
#include "NitroTracingOnLoad.hpp"
#include "core/NativeSampler.hpp"
#include <fbjni/fbjni.h>
#include <jni.h>

using margelo::nitro::tracingcore::FrameMonitor;

namespace {
// Resolved on the loader thread: FindClass from other threads cannot see app classes.
jclass frameSourceClass = nullptr;
jmethodID setEnabled = nullptr;

void registerFrameSource(JNIEnv *env) {
  jclass local = env->FindClass("com/margelo/nitro/nitrotracing/NitroTracingFrameSource");
  if (!local) {
    env->ExceptionClear();
    return; // Frame metrics are optional; CPU and memory sampling still work.
  }
  frameSourceClass = static_cast<jclass>(env->NewGlobalRef(local));
  env->DeleteLocalRef(local);
  setEnabled = env->GetStaticMethodID(frameSourceClass, "setEnabled", "(Z)V");
  FrameMonitor::instance().setToggle([](bool enabled) {
    JNIEnv *env = facebook::jni::Environment::ensureCurrentThreadIsAttached();
    env->CallStaticVoidMethod(frameSourceClass, setEnabled, static_cast<jboolean>(enabled));
    if (env->ExceptionCheck())
      env->ExceptionClear();
  });
}
} // namespace

extern "C" JNIEXPORT void JNICALL
Java_com_margelo_nitro_nitrotracing_NitroTracingFrameSource_nativeOnFrame(JNIEnv *, jclass, jlong frameTimeNanos) {
  // Choreographer frame times share the monotonic clock; 0 lets the monitor infer the interval.
  FrameMonitor::instance().onFrame(static_cast<double>(frameTimeNanos) / 1e9, 0);
}

extern "C" JNIEXPORT jboolean JNICALL Java_com_margelo_nitro_nitrotracing_HermesSampling_disable(JNIEnv *, jclass) {
  return margelo::nitro::nitrotracing::disableHermesSampling() ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *vm, void *) {
  return facebook::jni::initialize(vm, [] {
    margelo::nitro::nitrotracing::registerAllNatives();
    registerFrameSource(facebook::jni::Environment::current());
  });
}
