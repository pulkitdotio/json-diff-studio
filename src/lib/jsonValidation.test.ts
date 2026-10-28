import { describe, expect, it } from 'vitest'
import { MAX_BYTES, MAX_DEPTH, MAX_NODES, validateJson } from './jsonValidation'
import { formatJson } from './jsonFormatting'

describe('strict JSON validation and limits', () => {
  it.each(['', '   \n\t'])('distinguishes empty input %j', input => expect(validateJson(input).status).toBe('empty'))
  it.each(['{}', '[]', 'null', 'true', '123', '1.25', '"hello"', '{"a": [null, false]}'])('accepts valid JSON %s', input => expect(validateJson(input).status).toBe('valid'))
  it.each(['{', '{"a":}', '{"a":1,}', '//comment\n{}', '{a:1}', "{'a':1}", 'undefined', 'NaN', '01'])('rejects malformed or non-JSON input %s', input => expect(validateJson(input).status).toBe('invalid'))
  it('provides approximate locations when the engine exposes them', () => {
    const result = validateJson('{\n"a": @}')
    expect(result.status).toBe('invalid')
    if (result.status === 'invalid') {
      expect(result.message.length).toBeGreaterThan(0)
      // Engine messages differ; reported coordinates must be sensible when present.
      if (result.line !== undefined) { expect(result.line).toBe(2); expect(result.column).toBeGreaterThan(0) }
    }
  })
  it('enforces byte size including multibyte Unicode', () => {
    expect(validateJson('"' + 'x'.repeat(MAX_BYTES) + '"').status).toBe('invalid')
    expect(validateJson('"' + 'é'.repeat(MAX_BYTES / 2) + '"').status).toBe('invalid')
  })
  it('rejects deeply nested input gracefully and accepts the boundary', () => {
    expect(validateJson('['.repeat(MAX_DEPTH) + '0' + ']'.repeat(MAX_DEPTH)).status).toBe('valid')
    const result = validateJson('['.repeat(5000) + '0' + ']'.repeat(5000))
    expect(result).toMatchObject({ status: 'invalid', message: expect.stringContaining('nesting') })
  })
  it('bounds the number of parsed values', () => {
    expect(validateJson(JSON.stringify(Array(MAX_NODES).fill(0)))).toMatchObject({ status: 'invalid', message: expect.stringContaining('20,000') })
    expect(validateJson(JSON.stringify(Array(MAX_NODES - 1).fill(0))).status).toBe('valid')
  })
  it.each(['1e400', '9007199254740993', '-9007199254740993'])('rejects numbers outside the supported safe range %s', source => expect(validateJson(source).status).toBe('invalid'))
  it.each(['1.0000000000000001', '1e-400', '0.100000000000000005'])('rejects silently rounded or underflowed numeric literals %s', source => expect(validateJson(source)).toMatchObject({ status: 'invalid', message: expect.stringContaining('precision') }))
  it.each(['1.000', '1e-3', '0.100000', '-0', '"9007199254740993"'])('accepts equivalent number spellings and numeric strings %s', source => expect(validateJson(source).status).toBe('valid'))
})

describe('formatting', () => {
  it('uses two spaces and preserves data', () => {
    const source = '{"a":[1,{"b":true}],"empty":{}}'
    const output = formatJson(source)
    expect(output).toBe('{\n  "a": [\n    1,\n    {\n      "b": true\n    }\n  ],\n  "empty": {}\n}')
    expect(JSON.parse(output)).toEqual(JSON.parse(source))
  })
  it.each(['{"a":}', '', '// not JSON'])('does not alter invalid input %j', input => expect(formatJson(input)).toBe(input))
  it('preserves numeric literals, string escapes, duplicate keys, and punctuation inside strings', () => {
    const source = String.raw`{"n":1.25000,"n":1e-3,"s":"a,}:[\"\u0061"}`
    const output = formatJson(source)
    expect(output).toContain('1.25000')
    expect(output).toContain('1e-3')
    expect(output).toContain(String.raw`a,}:[\"\u0061`)
    expect((output.match(/"n"/g) ?? []).length).toBe(2)
    expect(JSON.parse(output)).toEqual(JSON.parse(source))
  })
})
