// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { publishRefs } from '../src/client/bridge'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('retries the refs post once after a failure', async () => {
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', fetchMock)
  publishRefs('s1', ['BLOCK'])
  await new Promise((resolve) => setTimeout(resolve, 380))
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(fetchMock.mock.calls[1][0]).toBe('/browser-studio/api/refs')
  expect(fetchMock.mock.calls[1][1]).toMatchObject({ keepalive: true })
})
