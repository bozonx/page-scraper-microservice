import { assertUrlAllowed } from '@/utils/ssrf.util.js'

describe('ssrf.util (unit)', () => {
  it('blocks private ipv4 ranges', async () => {
    await expect(assertUrlAllowed('http://10.0.0.1')).rejects.toThrow('SSRF blocked')
    await expect(assertUrlAllowed('http://192.168.1.1')).rejects.toThrow('SSRF blocked')
    await expect(assertUrlAllowed('http://169.254.169.254')).rejects.toThrow('SSRF blocked')
  })

  it('blocks localhost by default', async () => {
    await expect(assertUrlAllowed('http://127.0.0.1')).rejects.toThrow('SSRF blocked')
  })

  it('allows localhost when explicitly enabled (for tests)', async () => {
    const parsed = await assertUrlAllowed('http://127.0.0.1', { allowLocalhost: true })
    expect(parsed.hostname).toBe('127.0.0.1')
  })
})
