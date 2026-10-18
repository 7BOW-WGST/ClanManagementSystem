import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'

const FLASH_COOKIE = 'flash'

// Store a one-shot message to show on the next rendered page.
export function setFlash(c: Context, message: string): void {
  setCookie(c, FLASH_COOKIE, encodeURIComponent(message), {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    maxAge: 60,
  })
}

// Read and clear the flash message.
export function consumeFlash(c: Context): string | undefined {
  const raw = getCookie(c, FLASH_COOKIE)
  if (raw === undefined) {
    return undefined
  }
  deleteCookie(c, FLASH_COOKIE, { path: '/' })
  return decodeURIComponent(raw)
}
