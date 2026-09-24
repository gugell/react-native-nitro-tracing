import type { TracePlugin } from './TracePlugin'
type Handler = (error: unknown, isFatal?: boolean) => void
export interface ErrorUtilsLike {
  getGlobalHandler(): Handler
  setGlobalHandler(handler: Handler): void
}
export interface ErrorsPluginOptions {
  /** Defaults to React Native's global ErrorUtils. */
  errorUtils?: ErrorUtilsLike
  /** Also record console.error calls. Default false; libraries log non-fatal noise there. */
  console?: boolean
}
const messageOf = (value: unknown) =>
  value instanceof Error ? `${value.name}: ${value.message}` : String(value)
/** Records uncaught JS errors as `js.error` marks, then calls the previous handler unchanged. */
export function createErrorsPlugin(
  options: ErrorsPluginOptions = {}
): TracePlugin {
  return {
    id: 'errors',
    start({ recording, reportError }) {
      const utils =
        options.errorUtils ??
        (globalThis as unknown as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils
      let active = true
      let recordingError = false
      const record = (kind: string, message: string, fatal: boolean) => {
        if (!active || recordingError) return
        recordingError = true
        try {
          recording.mark({
            name: 'js.error',
            correlationId: '',
            attributes: [
              { key: 'source', value: 'error' },
              { key: 'kind', value: kind },
              { key: 'fatal', value: String(fatal) },
              { key: 'message', value: message.slice(0, 1024) },
            ],
          })
        } catch (error) {
          reportError(error)
        } finally {
          recordingError = false
        }
      }
      const previous = utils?.getGlobalHandler()
      const handler: Handler = (error, isFatal) => {
        record('global', messageOf(error), Boolean(isFatal))
        previous?.(error, isFatal)
      }
      utils?.setGlobalHandler(handler)
      const consoleError = console.error
      const patchedConsole = (...args: unknown[]) => {
        record('console', args.map(messageOf).join(' '), false)
        consoleError.apply(console, args)
      }
      if (options.console) console.error = patchedConsole
      return {
        stop() {
          active = false
          if (utils && previous && utils.getGlobalHandler() === handler)
            utils.setGlobalHandler(previous)
          if (console.error === patchedConsole) console.error = consoleError
        },
      }
    },
  }
}
