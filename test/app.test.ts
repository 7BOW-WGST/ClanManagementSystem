import { describe, expect, test } from 'bun:test'
import { app } from '../src/app'

// Test suite for the Hono application shell
describe('app shell', () => {
  test('GET / renders the index page', async () => {
    const response = await app.request('/') // Simulate a GET request to the root path

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')

    const body = await response.text()
    expect(body).toContain('Clan Management System')
  })
})
