import { createExpoTraceSharing, registerTraceDevMenu } from './index'
import type { Recording } from '../specs/Recording.nitro'
import type { TraceClient } from '../client/createTraceClient'
const mockWrite = jest.fn(async (..._args: unknown[]) => {})
const mockDelete = jest.fn(async (..._args: unknown[]) => {})
const mockShare = jest.fn(async (..._args: unknown[]) => {})
jest.mock('expo-sharing', () => ({
  isAvailableAsync: async () => true,
  shareAsync: (...args: unknown[]) => mockShare(...args),
}))
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: (...args: unknown[]) => mockWrite(...args),
  deleteAsync: (...args: unknown[]) => mockDelete(...args),
}))
beforeEach(() => jest.clearAllMocks())
it('shares JSON as a native file and cleans temporary data even on failure', async () => {
  const current = {
    exportJson: async () => '{"schemaVersion":1}',
    getStats: () => ({ sessionId: 'test' }),
  } as unknown as Recording
  const sharing = createExpoTraceSharing()
  mockShare.mockRejectedValueOnce(new Error('sheet failure'))
  await expect(sharing.share(current)).rejects.toThrow('sheet failure')
  const uri = mockWrite.mock.calls[0][0]
  expect(mockShare).toHaveBeenCalledWith(
    uri,
    expect.objectContaining({ mimeType: 'application/json' })
  )
  expect(mockDelete).toHaveBeenCalledWith(uri, { idempotent: true })
})
it('shares profiler paths as file URIs without deleting user artifacts', async () => {
  await createExpoTraceSharing().shareProfile('/cache/profile.cpuprofile')
  expect(mockShare).toHaveBeenCalledWith(
    'file:///cache/profile.cpuprofile',
    expect.anything()
  )
  expect(mockDelete).not.toHaveBeenCalled()
})
it('collapses the native developer menu before presenting the inspector', async () => {
  const client = {
    open: jest.fn(),
    reportError: jest.fn(),
  } as unknown as TraceClient
  const register = jest.fn(async () => {})
  await registerTraceDevMenu(client, { registerDevMenuItems: register })
  expect(register).toHaveBeenCalledWith([
    expect.objectContaining({ shouldCollapse: true }),
  ])
})
