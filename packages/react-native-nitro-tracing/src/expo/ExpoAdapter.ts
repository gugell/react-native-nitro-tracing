import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import type { TraceClient, TraceFormat } from '../client/createTraceClient'
import type { Recording } from '../specs/Recording.nitro'
export interface ExpoSharingOptions {
  dialogTitle?: string
}
/** Native OS file sharing. No remote upload or file-path export to telemetry. */
export function createExpoTraceSharing(options: ExpoSharingOptions = {}) {
  const shareFile = async (uri: string, mimeType: string) => {
    if (!(await Sharing.isAvailableAsync()))
      throw new Error('Native file sharing is unavailable on this device')
    await Sharing.shareAsync(uri, {
      mimeType,
      dialogTitle: options.dialogTitle ?? 'Share performance recording',
    })
  }
  return {
    async share(recording: Recording, format: TraceFormat = 'recording') {
      if (!FileSystem.cacheDirectory)
        throw new Error('Application cache is unavailable')
      const prefix = format === 'perfetto' ? 'perfetto-trace' : 'native-trace'
      const uri = `${FileSystem.cacheDirectory}${prefix}-${
        recording.getStats().sessionId
      }-${Date.now()}.json`
      // Both formats serialize off the JS thread; only the finished string crosses JSI.
      const json =
        format === 'perfetto'
          ? await recording.exportTraceEvents()
          : await recording.exportJson()
      try {
        await FileSystem.writeAsStringAsync(uri, json, {
          encoding: FileSystem.EncodingType.UTF8,
        })
        await shareFile(uri, 'application/json')
      } finally {
        await FileSystem.deleteAsync(uri, { idempotent: true })
      }
    },
    async shareProfile(path: string) {
      await shareFile(
        path.startsWith('file://') ? path : `file://${path}`,
        'application/octet-stream'
      )
    },
  }
}
/** Register only in a development build. The consumer owns client disposal. */
export async function registerTraceDevMenu(
  client: TraceClient,
  options: {
    name?: string
    registerDevMenuItems?: typeof import('expo-dev-client').registerDevMenuItems
  } = {}
) {
  try {
    const register =
      options.registerDevMenuItems ??
      (require('expo-dev-client') as typeof import('expo-dev-client'))
        .registerDevMenuItems
    await register([
      {
        name: options.name ?? 'Performance inspector',
        shouldCollapse: true,
        callback: () => client.open(),
      },
    ])
  } catch (error) {
    client.reportError(error)
  }
}
