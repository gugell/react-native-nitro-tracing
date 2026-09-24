# Called only from C++ over JNI; keep it through R8 in release builds.
-keep class com.margelo.nitro.nitrotracing.NitroTracingFrameSource { *; }
