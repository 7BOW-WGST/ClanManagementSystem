import { describe, expect, test } from 'bun:test'
import { app } from '../src/app'

describe('app shell', () => {
  test('GET /health responds ok', async () => {
    const response = await app.request('/health')

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('ok')
  })

  test('GET / redirects to the members list', async () => {
    const response = await app.request('/')

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/members')
  })
})
