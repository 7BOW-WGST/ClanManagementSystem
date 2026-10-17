// Server-side validation helpers.

// Read a trimmed string field from a parsed form body, or undefined when absent/blank.
export function stringField(body: Record<string, string | File>, name: string): string | undefined {
  const value = body[name]
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}
