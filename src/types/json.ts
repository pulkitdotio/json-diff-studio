export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
export type ChangeKind = 'added' | 'removed' | 'modified'
export type DiffStatus = ChangeKind | 'unchanged'

export interface DiffNode {
  path: string
  key: string
  status: DiffStatus
  before?: JsonValue
  after?: JsonValue
  children: DiffNode[]
  /** Atomic change count; changed containers themselves are not counted twice. */
  changes: number
}

export interface DiffResult {
  root: DiffNode
  changes: DiffNode[]
  counts: Record<ChangeKind | 'total', number>
}

export type Validation =
  | { status: 'empty'; message: string }
  | { status: 'invalid'; message: string; line?: number; column?: number }
  | { status: 'valid'; value: JsonValue; nodes: number }
