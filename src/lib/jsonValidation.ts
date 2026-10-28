import type { JsonValue, Validation } from '../types/json'

export const MAX_BYTES = 1024 * 1024
export const MAX_DEPTH = 100
export const MAX_NODES = 20_000

// Canonical decimal form, without expanding exponents into enormous strings.
function decimalSignature(token: string): string {
  const [mantissa, exponent = '0'] = token.toLowerCase().split('e')
  const negative = mantissa.startsWith('-')
  const [integer, fraction = ''] = (negative ? mantissa.slice(1) : mantissa).split('.')
  const digits = (integer + fraction).replace(/^0+/, '')
  if (!digits) return '0'
  const coefficient = digits.replace(/0+$/, '')
  const power = Number(exponent) - fraction.length + digits.length - coefficient.length
  return `${negative ? '-' : ''}${coefficient}e${power}`
}

export function validateJson(source: string): Validation {
  if (!source.trim()) return { status: 'empty', message: 'Paste JSON or upload a file to get started.' }
  if (source.length > MAX_BYTES || new TextEncoder().encode(source).length > MAX_BYTES) {
    return { status: 'invalid', message: 'This document exceeds the 1 MiB size limit.' }
  }
  let value: JsonValue
  try {
    value = JSON.parse(source) as JsonValue
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Check your JSON syntax.'
    const position = detail.match(/position\s+(\d+)/i)
    const location = detail.match(/line\s+(\d+)\s+column\s+(\d+)/i)
    let line: number | undefined
    let column: number | undefined
    if (position) {
      const prefix = source.slice(0, Number(position[1]))
      line = prefix.split('\n').length
      column = prefix.length - prefix.lastIndexOf('\n')
    } else if (location) {
      line = Number(location[1])
      column = Number(location[2])
    }
    return { status: 'invalid', message: detail, line, column }
  }
  // Iterative traversal avoids a call-stack overflow before depth can be checked.
  const pending: { value: JsonValue; depth: number }[] = [{ value, depth: 0 }]
  let nodes = 0
  while (pending.length) {
    const current = pending.pop()!
    if (++nodes > MAX_NODES) return { status: 'invalid', message: 'This document exceeds the 20,000-value limit.' }
    if (current.depth > MAX_DEPTH) return { status: 'invalid', message: 'This document exceeds the 100-level nesting limit.' }
    if (typeof current.value === 'number' && (!Number.isFinite(current.value) || (Number.isInteger(current.value) && !Number.isSafeInteger(current.value)))) {
      return { status: 'invalid', message: 'A number exceeds JavaScript’s safe range. Use a string for very large numbers or IDs.' }
    }
    if (current.value !== null && typeof current.value === 'object') {
      for (const child of Object.values(current.value)) pending.push({ value: child, depth: current.depth + 1 })
    }
  }
  // Skip complete strings, including escaped quotes, when inspecting literals.
  // Reject precision loss and underflow instead of comparing silently rounded values.
  for (const match of source.matchAll(/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g)) {
    const token = match[0]
    if (!token.startsWith('"') && decimalSignature(token) !== decimalSignature(String(Number(token)))) {
      return { status: 'invalid', message: 'A number would lose precision in JavaScript. Use a string to preserve this exact value.' }
    }
  }
  return { status: 'valid', value, nodes }
}
