# Called only from C++ over JNI; keep it through R8 in release builds.
-keep class com.margelo.nitro.nitrotracing.NitroTracingFrameSource { *; }
# Reload guard: instantiated from ReactModuleInfo by class name; its JNI bridge is native.
-keep class com.margelo.nitro.nitrotracing.HermesSamplingGuard { *; }
-keep class com.margelo.nitro.nitrotracing.HermesSampling { *; }
