import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, CheckCheck, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Copy, FileDiff, Filter, GitCompareArrows, Minus, Plus, RefreshCw } from 'lucide-react'
import type { ChangeKind, DiffNode, DiffResult, JsonValue } from '../types/json'
import { serializeDiff } from '../lib/jsonDiff'
import { DiffSummary } from './DiffSummary'

type FilterKind = 'all' | ChangeKind
interface Props { result: DiffResult | null; stale: boolean; onCopy: (text: string, label: string) => Promise<boolean>; onExample: () => void }
const labels = { added: 'Added', removed: 'Removed', modified: 'Modified', unchanged: 'Unchanged' }

function preview(value: JsonValue | undefined): string {
  if (value === undefined) return '—'
  if (Array.isArray(value)) return `[ ${value.length} ${value.length === 1 ? 'item' : 'items'} ]`
  if (value !== null && typeof value === 'object') return `{ ${Object.keys(value).length} ${Object.keys(value).length === 1 ? 'key' : 'keys'} }`
  const text = JSON.stringify(value)
  return text.length > 150 ? text.slice(0, 147) + '…' : text
}

function Value({ value }: { value: JsonValue | undefined }) {
  return <code className={`json-value type-${value === null ? 'null' : typeof value}`}>{preview(value)}</code>
}

export function DiffViewer({ result, stale, onCopy, onExample }: Props) {
  const [filter, setFilter] = useState<FilterKind>('all')
  const [showUnchanged, setShowUnchanged] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [rowLimit, setRowLimit] = useState(400)
  const [detail, setDetail] = useState<DiffNode | null>(null)
  const relevant = useMemo(() => {
    const paths = new Set<string>()
    if (!result) return paths
    function include(node: DiffNode): boolean {
      const childrenMatch = node.children.map(include).some(Boolean)
      const selfMatch = node.children.length === 0 && (node.status === 'unchanged' ? showUnchanged && filter === 'all' : filter === 'all' || node.status === filter)
      if (childrenMatch || selfMatch) paths.add(node.path)
      return childrenMatch || selfMatch
    }
    include(result.root)
    return paths
  }, [result, filter, showUnchanged])
  const rows = useMemo(() => {
    const output: { node: DiffNode; depth: number }[] = []
    if (!result) return output
    function visit(node: DiffNode, depth: number) {
      if (!relevant.has(node.path)) return
      output.push({ node, depth })
      if (!collapsed.has(node.path)) node.children.forEach(child => visit(child, depth + 1))
    }
    visit(result.root, 0)
    return output
  }, [result, relevant, collapsed])

  function toggle(path: string) {
    setCollapsed(previous => { const next = new Set(previous); if (next.has(path)) next.delete(path); else next.add(path); return next })
  }

  return <section className="results-panel" aria-labelledby="results-title">
    <div className="results-header">
      <div className="flex items-center gap-2.5"><GitCompareArrows size={18} className="accent-text" /><h2 id="results-title">Comparison results</h2><span className={`result-state ${stale ? 'stale' : ''}`}>{stale ? 'Out of date' : result ? 'Compared' : 'Ready when you are'}</span></div>
      <button className="text-button" disabled={!result} onClick={() => { if (result) void onCopy(serializeDiff(result), stale ? 'Previous diff report (out of date)' : 'Diff report') }}><Copy size={14} /> Copy report</button>
    </div>
    {stale && <div className="stale-banner" role="status"><RefreshCw size={14} /> Inputs have changed. Compare again to update these results. The report below is from your previous comparison.</div>}
    {!result ? <div className="results-empty">
      <div className="empty-illustration"><FileDiff size={30} strokeWidth={1.3} /><span className="mini-plus">+</span></div>
      <h3>A little clarity for your JSON.</h3>
      <p>Add your original and modified JSON, then hit compare.<br />We’ll show you every addition, removal, and change.</p>
      <button className="text-button accent-text" onClick={onExample}>Try it with an example <ArrowRight size={14} /></button>
    </div> : <>
      <DiffSummary counts={result.counts} />
      <div className="result-filters">
        <div className="filter-tabs" role="group" aria-label="Filter differences">
          {(['all', 'added', 'removed', 'modified'] as const).map(item => <button key={item} className={`filter-tab ${filter === item ? 'active' : ''}`} aria-label={`${item === 'all' ? 'All changes' : labels[item]} ${result.counts[item === 'all' ? 'total' : item]}`} aria-pressed={filter === item} onClick={() => { setFilter(item); setRowLimit(400) }}>
            {item === 'all' ? <Filter size={12} /> : item === 'added' ? <Plus size={12} /> : item === 'removed' ? <Minus size={12} /> : <RefreshCw size={11} />}
            {item === 'all' ? 'All changes' : labels[item]}<span>{result.counts[item === 'all' ? 'total' : item]}</span>
          </button>)}
        </div>
        <div className="view-options">
          <label className="unchanged-toggle"><input type="checkbox" checked={showUnchanged} onChange={event => { setShowUnchanged(event.target.checked); setRowLimit(400) }} />Show unchanged</label>
          <span className="small-divider" />
          <button className="icon-button small" title="Expand all" aria-label="Expand all nodes" onClick={() => setCollapsed(new Set())}><ChevronsUpDown size={15} /></button>
          <button className="icon-button small" title="Collapse all" aria-label="Collapse all nodes" onClick={() => { const paths = new Set<string>(); function visit(node: DiffNode) { if (node.children.length) paths.add(node.path); node.children.forEach(visit) } visit(result.root); setCollapsed(paths) }}><ChevronsDownUp size={15} /></button>
        </div>
      </div>
      {result.counts.total === 0 && <div className="identical-message" role="status"><CheckCheck size={19} /><div><strong>Perfect match.</strong> These JSON documents are identical. Object key order doesn’t affect the comparison.</div></div>}
      {rows.length ? <div className="diff-table-scroll"><div className="diff-table" role="table" aria-label="JSON differences">
        <div className="diff-table-heading" role="row"><span role="columnheader">PROPERTY / JSON POINTER</span><span role="columnheader">ORIGINAL</span><span role="columnheader">MODIFIED</span><span role="columnheader">CHANGE</span></div>
        {rows.slice(0, rowLimit).map(({ node, depth }) => <div className={`diff-row ${node.children.length ? 'group-row' : node.status}`} role="row" key={node.path}>
          <div className="path-cell" role="cell" style={{ paddingLeft: `${16 + Math.min(depth, 8) * 16}px` }}>
            {node.children.length > 0 ? <button className="node-toggle" aria-expanded={!collapsed.has(node.path)} aria-label={`${collapsed.has(node.path) ? 'Expand' : 'Collapse'} ${node.path || 'root'}`} onClick={() => toggle(node.path)}>{collapsed.has(node.path) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</button> : <span className={`node-symbol ${node.status}`}>{node.status === 'added' ? '+' : node.status === 'removed' ? '−' : node.status === 'modified' ? '~' : '·'}</span>}
            <button className="property-name" onClick={() => setDetail(node)} title={`Inspect ${node.path || '(root)'}`}>{node.path === '' ? <><span className="root-brace" aria-hidden="true">$</span> root</> : JSON.stringify(node.key)}</button>
            {node.children.length > 0 && <span className="node-child-count">{node.children.length}</span>}
          </div>
          <div className="value-cell" role="cell"><span className="mobile-value-label">Original</span><Value value={node.before} /></div>
          <div className="value-cell" role="cell"><span className="mobile-value-label">Modified</span><Value value={node.after} /></div>
          <div className="change-cell" role="cell">{node.children.length && node.changes ? <span className="nested-count">{node.changes} {node.changes === 1 ? 'change' : 'changes'}</span> : <span className={`change-badge ${node.status}`}>{labels[node.status]}</span>}</div>
        </div>)}
      </div></div> : result.counts.total > 0 && <div className="no-filter-results">No {filter === 'all' ? '' : filter + ' '}changes to display.</div>}
      {rows.length > rowLimit && <div className="load-more"><span>Showing {rowLimit} of {rows.length.toLocaleString()} visible nodes</span><button className="text-button accent-text" onClick={() => setRowLimit(limit => limit + 400)}>Show 400 more <ChevronDown size={14} /></button></div>}
      <div className="results-footer"><span><span className="live-dot" /> Comparison complete</span><span>Atomic changes · Positional arrays · Select a property to inspect</span></div>
    </>}
    {detail && <DetailDialog node={detail} onClose={() => setDetail(null)} onCopy={onCopy} />}
  </section>
}

function DetailDialog({ node, onClose, onCopy }: { node: DiffNode; onClose: () => void; onCopy: Props['onCopy'] }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const element = dialog.current
    element?.showModal()
    return () => { element?.close(); previousFocus?.focus({ preventScroll: true }) }
  }, [])
  return <dialog className="detail-dialog" ref={dialog} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }} aria-labelledby="detail-title">
    <div className="dialog-content"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">VALUE INSPECTOR</p><h3 id="detail-title">{node.path || '(root)'}</h3></div><button className="text-button" onClick={onClose}>Close <kbd>Esc</kbd></button></div>
      <p className="detail-explanation">RFC 6901 JSON Pointer. An empty path identifies the document root.</p>
      <div className="detail-values">{(['before', 'after'] as const).map(side => <section key={side}><div className="flex justify-between items-center"><h4>{side === 'before' ? 'Original value' : 'Modified value'}</h4><button className="text-button" disabled={node[side] === undefined} onClick={() => { void onCopy(JSON.stringify(node[side], null, 2), 'Value') }}><Copy size={13} /> Copy</button></div><pre>{node[side] === undefined ? '(missing)' : JSON.stringify(node[side], null, 2)}</pre></section>)}</div>
    </div>
  </dialog>
}
