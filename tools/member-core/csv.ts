export interface ParsedCsvRow {
  line: number
  values: string[]
}

// Minimal RFC 4180-style parser: quoted fields, escaped quotes, commas, and newlines.
export function parseCsv(text: string): ParsedCsvRow[] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: ParsedCsvRow[] = []
  let values: string[] = []
  let value = ''
  let inQuotes = false
  let line = 1
  let rowStartLine = 1
  let index = 0

  const pushValue = (): void => {
    values.push(value)
    value = ''
  }

  const pushRow = (): void => {
    pushValue()
    rows.push({ line: rowStartLine, values })
    values = []
  }

  while (index < input.length) {
    const character = input[index]

    if (inQuotes) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          value += '"'
          index += 2
          continue
        }
        inQuotes = false
        index += 1
        continue
      }
      if (character === '\n') {
        line += 1
      }
      value += character
      index += 1
      continue
    }

    if (character === '"') {
      inQuotes = true
      index += 1
      continue
    }
    if (character === ',') {
      pushValue()
      index += 1
      continue
    }
    if (character === '\r') {
      index += 1
      continue
    }
    if (character === '\n') {
      pushRow()
      line += 1
      rowStartLine = line
      index += 1
      continue
    }

    value += character
    index += 1
  }

  if (value !== '' || values.length > 0) {
    pushRow()
  }

  return rows
}

export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`
  }
  return value
}
