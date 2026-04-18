const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

export function normalizeDateOnly(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (DATE_ONLY_RE.test(trimmed)) {
    return trimmed
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString().slice(0, 10)
}

export function getLocalDateInputValue(date = new Date()): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10)
}

function getDateOnlyTimestamp(value: string): number | null {
  const normalized = normalizeDateOnly(value)
  if (!normalized) return null

  const [year, month, day] = normalized.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

export function daysUntilDateOnly(value: string, now = new Date()): number | null {
  const target = getDateOnlyTimestamp(value)
  if (target === null) return null

  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target - today) / 86400000)
}

export function formatDateOnly(
  value: string,
  locale: string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  const timestamp = getDateOnlyTimestamp(value)
  if (timestamp === null) return value

  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: 'UTC',
  }).format(new Date(timestamp))
}
