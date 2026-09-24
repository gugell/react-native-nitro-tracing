package com.margelo.nitro.nitrotracing

import android.os.Handler
import android.os.Looper
import android.view.Choreographer

/**
 * Main-thread Choreographer callbacks, started only while a native sampler needs frames.
 * A callback delayed past its vsync means the main thread was busy; the C++ FrameMonitor
 * infers the display interval from the shortest recent gap.
 */
object NitroTracingFrameSource : Choreographer.FrameCallback {
  private val main = Handler(Looper.getMainLooper())
  private var running = false

  @JvmStatic
  fun setEnabled(enabled: Boolean) {
    main.post {
      if (enabled && !running) {
        running = true
        Choreographer.getInstance().postFrameCallback(this)
      } else if (!enabled && running) {
        running = false
        Choreographer.getInstance().removeFrameCallback(this)
      }
    }
  }

  override fun doFrame(frameTimeNanos: Long) {
    if (!running) return
    nativeOnFrame(frameTimeNanos)
    Choreographer.getInstance().postFrameCallback(this)
  }

  @JvmStatic private external fun nativeOnFrame(frameTimeNanos: Long)
}
