package com.margelo.nitro.nitrotracing

import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.bridge.BaseJavaModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.turbomodule.core.interfaces.TurboModule
import java.util.Collections
import java.util.WeakHashMap

/**
 * Stops Hermes' sampling profiler before a reload tears down the JS runtime.
 *
 * The sampler is process-wide. If a reload destroys the JS thread while it samples, the
 * sampler signals a dead thread and the app aborts (`invalid pthread_t` on `hermes-sampling`).
 * React Native quits the JS thread before invalidating modules, so this registers a
 * ReactHost before-destroy listener, which runs while the thread is still alive.
 * Eagerly initialized; JS never calls it.
 */
internal class HermesSamplingGuard(context: ReactApplicationContext) :
    BaseJavaModule(context), TurboModule {
  init {
    (context.applicationContext as? ReactApplication)?.reactHost?.let(::watch)
  }

  override fun getName() = NAME

  companion object {
    const val NAME = "NitroTracingHermesSamplingGuard"
    // One listener per host; a new module instance is created on every reload.
    private val watched = Collections.newSetFromMap(WeakHashMap<ReactHost, Boolean>())

    private fun watch(host: ReactHost) {
      synchronized(watched) { if (!watched.add(host)) return }
      host.addBeforeDestroyListener { runCatching { HermesSampling.disable() } }
    }
  }
}

/** JNI bridge to cpp/HermesSampling.cpp. */
internal object HermesSampling {
  @JvmStatic external fun disable(): Boolean
}
