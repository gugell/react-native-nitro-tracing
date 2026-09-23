import type { HybridObject } from 'react-native-nitro-modules'
import type { Recording } from './Recording.nitro'
import type { RecordingOptions } from '../types'
/** Factory for independent native recordings. Exported as Tracing. */
export interface Tracing extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  /** Create an active recording with explicit validated retention limits. */
  startRecording(options: RecordingOptions): Recording
}
