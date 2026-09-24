import type { HybridObject } from 'react-native-nitro-modules'
import type { Recording } from './Recording.nitro'
import type { RecordingOptions } from '../types'
/** Factory for independent native recordings. Exported as Tracing. */
export interface Tracing extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  /** Create an active recording with explicit validated retention limits. */
  startRecording(options: RecordingOptions): Recording
  /**
   * Stop Hermes' process-wide sampling profiler. The release-profiler plugin calls this
   * after saving a profile: on React Native 0.85 Android the profiler's own stop restarts
   * sampling. Returns false where Hermes is not linked (iOS stops correctly itself).
   */
  disableHermesSampling(): boolean
}
