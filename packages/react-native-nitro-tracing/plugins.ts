export { startPlugins } from './src/plugins/startPlugins'
export type {
  TracePlugin,
  PluginContext,
  PluginHandle,
} from './src/plugins/TracePlugin'

export { createRuntimeMetricsPlugin } from './src/plugins/runtimeMetrics'
export type { RuntimeMetricsOptions } from './src/plugins/runtimeMetrics'

export {
  createNavigationPlugin,
  createScreenTracker,
} from './src/plugins/navigation'
export type {
  NavigationRefLike,
  NavigationPluginOptions,
} from './src/plugins/navigation'
export { createNetworkPlugin, urlTemplate } from './src/plugins/network'
export type { NetworkPluginOptions } from './src/plugins/network'
export { createErrorsPlugin } from './src/plugins/errors'
export type { ErrorsPluginOptions, ErrorUtilsLike } from './src/plugins/errors'
export { createNativeMetricsPlugin } from './src/plugins/nativeMetrics'
export type { NativeMetricsOptions } from './src/plugins/nativeMetrics'
