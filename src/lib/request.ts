import { NextRequest } from 'next/server'

/**
 * Extract client IP from a NextRequest in a reliable way.
 * Checks common headers (x-forwarded-for, x-real-ip) and falls back to 'unknown'.
 */
export function getClientIp(request: NextRequest): string {
  if (!request || !request.headers) return 'unknown'
  const xff = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''
  if (xff) {
    // x-forwarded-for can contain multiple IPs: client, proxy1, proxy2...
    return xff.split(',')[0].trim()
  }
  return 'unknown'
}