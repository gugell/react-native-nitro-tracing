import { NitroModules } from 'react-native-nitro-modules'
import type { Tracing as TracingFactory } from './specs/Tracing.nitro'
/** Native recording factory. See Recording for ownership and cleanup. */
export const Tracing =
  NitroModules.createHybridObject<TracingFactory>('Tracing')
export type { Recording } from './specs/Recording.nitro'
export type { TraceSpan } from './specs/TraceSpan.nitro'
export type * from './types'
