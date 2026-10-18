import type { Context } from 'hono'

// Number of rows shown per list page.
export const PAGE_SIZE = 25

// Limit/offset/search options for list queries.
export interface ListOptions {
  limit?: number
  offset?: number
  search?: string
}

// Build a case-insensitive LIKE pattern from a search string, or undefined when empty.
export function searchPattern(search: string | undefined): string | undefined {
  const trimmed = search?.trim()
  return trimmed ? `%${trimmed}%` : undefined
}

export interface PageParams {
  page: number
  limit: number
  offset: number
}

// Parse the ?page= query parameter into limit/offset.
export function pageParams(c: Context): PageParams {
  const raw = Number(c.req.query('page'))
  const page = Number.isInteger(raw) && raw > 0 ? raw : 1
  return { page, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }
}

// Total number of pages for a result count.
export function pageCount(total: number, limit: number): number {
  return Math.max(1, Math.ceil(total / limit))
}
