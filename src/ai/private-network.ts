/** Names that only mean something inside a home or office network. */
const LOCAL_NAMES = /(?:^|\.)(?:localhost|local|internal|lan|home\.arpa)$/

/** Private, loopback, link-local and shared address blocks, as [first byte, second byte from, second byte to]. */
const PRIVATE_V4: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 255],
  [10, 0, 255],
  [127, 0, 255],
  [100, 64, 127],
  [169, 254, 254],
  [172, 16, 31],
  [192, 168, 168],
]

function isPrivateV4(a: number, b: number): boolean {
  return PRIVATE_V4.some(([first, from, to]) => a === first && b >= from && b <= to)
}

function v4(host: string): [number, number] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(host)
  return match ? [Number(match[1]), Number(match[2])] : null
}

function isPrivateV6(host: string): boolean {
  if (host === '::1' || host === '::') return true
  if (/^f[cd][0-9a-f]{0,2}:/.test(host)) return true // unique local, fc00::/7
  if (/^fe[89ab][0-9a-f]?:/.test(host)) return true // link-local, fe80::/10
  // An IPv4 address inside IPv6, which URL writes as ::ffff:c0a8:101.
  const mapped = /^::ffff:([0-9a-f]{1,4}):[0-9a-f]{1,4}$/.exec(host)
  if (!mapped) return false
  const high = parseInt(mapped[1]!, 16)
  return isPrivateV4(high >> 8, high & 0xff)
}

/**
 * True for a host on the user's own network, or the computer itself. The host is as
 * URL gives it, which has already turned forms such as 2130706433 into 127.0.0.1.
 */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host.includes(':')) return isPrivateV6(host)
  const parts = v4(host)
  if (parts) return isPrivateV4(...parts)
  return !host.includes('.') || LOCAL_NAMES.test(host)
}
