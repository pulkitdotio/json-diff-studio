import type { DiffNode, DiffResult, JsonValue } from '../types/json'

export function escapePointer(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1')
}

function kind(value: JsonValue): string {
  return value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
}

/** Inputs must have passed validateJson (bounded, JSON-compatible values). */
export function compareJson(before: JsonValue, after: JsonValue): DiffResult {
  const changes: DiffNode[] = []
  const counts: DiffResult['counts'] = { total: 0, added: 0, removed: 0, modified: 0 }
  function visit(oldValue: JsonValue | undefined, newValue: JsonValue | undefined, path: string, key: string): DiffNode {
    const node: DiffNode = { path, key, before: oldValue, after: newValue, status: 'unchanged', children: [], changes: 0 }
    if (oldValue === undefined) node.status = 'added'
    else if (newValue === undefined) node.status = 'removed'
    else if (kind(oldValue) === kind(newValue) && oldValue !== null && typeof oldValue === 'object') {
      const oldObject = oldValue as Record<string, JsonValue>
      const newObject = newValue as Record<string, JsonValue>
      const keys = Array.isArray(oldValue)
        ? Array.from({ length: Math.max(oldValue.length, (newValue as JsonValue[]).length) }, (_, i) => String(i))
        : [...new Set([...Object.keys(oldObject), ...Object.keys(newObject)])].sort()
      node.children = keys.map(childKey => visit(
        Object.hasOwn(oldObject, childKey) ? oldObject[childKey] : undefined,
        Object.hasOwn(newObject, childKey) ? newObject[childKey] : undefined,
        `${path}/${escapePointer(childKey)}`, childKey,
      ))
      node.changes = node.children.reduce((sum, child) => sum + child.changes, 0)
      if (node.changes) node.status = 'modified'
      return node
    } else if (oldValue !== newValue) node.status = 'modified'
    if (node.status !== 'unchanged') {
      node.changes = 1
      changes.push(node)
      counts[node.status]++
      counts.total++
    }
    return node
  }
  const root = visit(before, after, '', '$')
  return { root, changes, counts }
}

export function serializeDiff(result: DiffResult): string {
  return JSON.stringify({
    format: 'json-diff-studio/v1',
    paths: 'RFC 6901 JSON Pointer; empty string is the root',
    arrayComparison: 'positional',
    counts: result.counts,
    changes: result.changes.map(({ path, status, before, after }) => ({ path, status, before, after })),
  }, null, 2)
}
