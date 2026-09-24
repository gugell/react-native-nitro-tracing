package com.margelo.nitro.nitrotracing

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class NitroTracingPackage : BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        if (name == HermesSamplingGuard.NAME) HermesSamplingGuard(reactContext) else null

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
        mapOf(
            HermesSamplingGuard.NAME to ReactModuleInfo(
                HermesSamplingGuard.NAME,
                HermesSamplingGuard::class.java.name,
                false, // canOverrideExistingModule
                true, // needsEagerInit: registers the reload guard at startup
                false, // isCxxModule
                true, // isTurboModule
            ),
        )
    }

    companion object {
        init {
            NitroTracingOnLoad.initializeNative()
        }
    }
}
