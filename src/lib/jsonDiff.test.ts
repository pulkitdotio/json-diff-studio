import { describe, expect, it } from 'vitest'
import { compareJson, escapePointer, serializeDiff } from './jsonDiff'
import type { JsonValue } from '../types/json'

describe('JSON comparison', () => {
  it('recognizes identical nested JSON and retains unchanged nodes', () => {
    const json = { a: [1, null, { b: true }], empty: {} }
    const result = compareJson(json, json)
    expect(result.counts).toEqual({ total: 0, added: 0, removed: 0, modified: 0 })
    expect(result.root.children.every(node => node.status === 'unchanged')).toBe(true)
  })

  it.each([
    [{}, { x: 1 }, 'added', '/x', undefined, 1],
    [{ x: 1 }, {}, 'removed', '/x', 1, undefined],
    [{ x: 1 }, { x: 2 }, 'modified', '/x', 1, 2],
    [{ a: { b: 1 } }, { a: { b: 2 } }, 'modified', '/a/b', 1, 2],
    [[1], [1, 2], 'added', '/1', undefined, 2],
    [[1, 2], [1], 'removed', '/1', 2, undefined],
    [{}, { x: null }, 'added', '/x', undefined, null],
    [{ x: null }, {}, 'removed', '/x', null, undefined],
    [false, true, 'modified', '', false, true],
    [1, '1', 'modified', '', 1, '1'],
    [null, false, 'modified', '', null, false],
    [[], {}, 'modified', '', [], {}],
    [{ x: {} }, { x: [] }, 'modified', '/x', {}, []],
  ] as [JsonValue, JsonValue, string, string, JsonValue | undefined, JsonValue | undefined][])(
    'compares %j → %j without coercing values', (before, after, status, path, oldValue, newValue) => {
      const result = compareJson(before, after)
      expect(result.changes).toHaveLength(1)
      expect(result.changes[0]).toMatchObject({ status, path, before: oldValue, after: newValue })
      expect(result.counts.total).toBe(1)
    },
  )

  it('compares array order positionally', () => {
    const result = compareJson(['a', 'b'], ['b', 'a'])
    expect(result.counts.modified).toBe(2)
    expect(result.changes.map(node => node.path)).toEqual(['/0', '/1'])
  })

  it('keeps numeric array paths in numeric order', () => {
    const result = compareJson([], Array.from({ length: 12 }, (_, index) => index))
    expect(result.changes.map(node => node.path)).toEqual(Array.from({ length: 12 }, (_, index) => `/${index}`))
  })

  it.each([[{}, {}], [[], []], [null, null], ['a', 'a'], [0, -0]])('recognizes equal empty or primitive values %j and %j', (a, b) => {
    expect(compareJson(a as JsonValue, b as JsonValue).counts.total).toBe(0)
  })

  it('ignores object insertion order and emits deterministic sorted paths', () => {
    expect(compareJson({ b: 2, a: 1 }, { a: 1, b: 2 }).counts.total).toBe(0)
    expect(compareJson({}, { z: 1, a: 1, c: 1 }).changes.map(node => node.path)).toEqual(['/a', '/c', '/z'])
  })

  it('escapes slashes and tildes without interpreting dots or empty names', () => {
    const result = compareJson({}, { 'a/b': 1, 'a~b': 2, 'a.b': 3, '': 4 })
    expect(result.changes.map(node => node.path)).toEqual(['/', '/a.b', '/a~1b', '/a~0b'])
    expect(escapePointer('~/')).toBe('~0~1')
  })

  it('handles own keys named __proto__, constructor, and toString safely', () => {
    const value = JSON.parse('{"__proto__":null,"constructor":1,"toString":2}') as JsonValue
    expect(compareJson({}, value).counts.added).toBe(3)
    expect(compareJson(value, {}).counts.removed).toBe(3)
  })

  it('counts whole additions and type replacements once and nested edits individually', () => {
    const result = compareJson({ edit: { a: 1, b: 2 }, replace: null }, { edit: { a: 2, b: 3 }, replace: { c: 1 }, add: { x: [1, 2] } })
    expect(result.counts).toEqual({ total: 4, added: 1, removed: 0, modified: 3 })
    expect(result.root.changes).toBe(4)
  })

  it('does not mutate parsed inputs', () => {
    const before = Object.freeze({ a: Object.freeze([1, 2]) })
    const after = Object.freeze({ a: Object.freeze([2, 3]) })
    compareJson(before as unknown as JsonValue, after as unknown as JsonValue)
    expect(before.a).toEqual([1, 2])
    expect(after.a).toEqual([2, 3])
  })

  it('exports a structured report including root and missing semantics', () => {
    const report = JSON.parse(serializeDiff(compareJson({ null: null }, { added: null })))
    expect(report.counts.total).toBe(2)
    expect(report.changes).toContainEqual({ path: '/added', status: 'added', after: null })
    expect(report.changes).toContainEqual({ path: '/null', status: 'removed', before: null })
    expect(JSON.parse(serializeDiff(compareJson(1, 2))).changes[0].path).toBe('')
  })
})
