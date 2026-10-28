import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Command, CornerDownLeft, ShieldCheck, X } from 'lucide-react'
import { Header, PrivacyNote } from './components/Header'
import { JsonEditor } from './components/JsonEditor'
import { CompareToolbar } from './components/CompareToolbar'
import { DiffViewer } from './components/DiffViewer'
import { validateJson } from './lib/jsonValidation'
import { compareJson } from './lib/jsonDiff'
import { sampleModified, sampleOriginal } from './data/sampleJson'
import type { DiffResult } from './types/json'

type Inputs = { original: string; modified: string }
type Comparison = { result: DiffResult; inputs: Inputs; id: number }
type WorkspaceState = { inputs: Inputs; undo: Inputs | null }
type WorkspaceAction =
  | { type: 'edit' | 'replace-side'; side: keyof Inputs; value: string }
  | { type: 'replace'; inputs: Inputs }
  | { type: 'swap' | 'undo' }

function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  if (action.type === 'edit' || action.type === 'replace-side') return {
    inputs: { ...state.inputs, [action.side]: action.value },
    undo: action.type === 'replace-side' ? state.inputs : state.undo,
  }
  if (action.type === 'replace') return { inputs: action.inputs, undo: state.inputs }
  if (action.type === 'swap') return { inputs: { original: state.inputs.modified, modified: state.inputs.original }, undo: state.inputs }
  return state.undo ? { inputs: state.undo, undo: null } : state
}

function initialTheme() {
  try { return localStorage.getItem('json-diff-theme') === 'light' ? 'light' : 'dark' } catch { return 'dark' }
}

export default function App() {
  const [{ inputs, undo }, dispatch] = useReducer(workspaceReducer, { inputs: { original: '', modified: '' }, undo: null })
  const [comparison, setComparison] = useState<Comparison | null>(null)
  const [theme, setTheme] = useState(initialTheme)
  const [toast, setToast] = useState<{ message: string; error: boolean; id: number } | null>(null)
  const sequence = useRef(0)
  const originalValidation = useMemo(() => validateJson(inputs.original), [inputs.original])
  const modifiedValidation = useMemo(() => validateJson(inputs.modified), [inputs.modified])
  const canCompare = originalValidation.status === 'valid' && modifiedValidation.status === 'valid'
  const stale = comparison !== null && (comparison.inputs.original !== inputs.original || comparison.inputs.modified !== inputs.modified)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#111313' : '#f6f7f4')
    try { localStorage.setItem('json-diff-theme', theme) } catch { /* Theme still works without browser storage. */ }
  }, [theme])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const hasInput = Boolean(inputs.original || inputs.modified)
  useEffect(() => {
    if (!hasInput) return
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [hasInput])

  function notify(message: string, error = false) { setToast({ message, error, id: Date.now() }) }

  function compare() {
    if (originalValidation.status !== 'valid' || modifiedValidation.status !== 'valid') return
    const result = compareJson(originalValidation.value, modifiedValidation.value)
    setComparison({ result, inputs: { ...inputs }, id: ++sequence.current })
    notify(result.counts.total ? `Comparison complete. ${result.counts.total} changes found.` : 'Comparison complete. Your JSON documents are identical.')
  }

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); compare() }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  })

  function replace(next: Inputs) { dispatch({ type: 'replace', inputs: next }) }

  function loadExample() {
    const next = { original: sampleOriginal, modified: sampleModified }
    replace(next)
    const before = validateJson(next.original)
    const after = validateJson(next.modified)
    if (before.status === 'valid' && after.status === 'valid') setComparison({ result: compareJson(before.value, after.value), inputs: next, id: ++sequence.current })
    notify('Example loaded and compared. Undo restores your previous inputs.')
  }

  async function copy(text: string, label: string): Promise<boolean> {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(text)
      notify(`${label} copied to clipboard.`)
      return true
    } catch { notify('Could not copy. Check clipboard permissions or select and copy the text manually.', true); return false }
  }

  return <>
    <a className="skip-link" href="#main">Skip to workspace</a>
    <Header theme={theme} onToggleTheme={() => setTheme(current => current === 'dark' ? 'light' : 'dark')} />
    <main id="main" className="workspace">
      <div className="workspace-intro">
        <div><div className="eyebrow"><span className="eyebrow-line" /> LESS GUESSWORK. MORE CLARITY.</div><h1>See exactly what changed<span className="accent-text">.</span></h1><p>Two JSON documents. One clear picture of the difference.</p></div>
        <div className="workspace-meta"><span className="workspace-badge"><span className="live-dot" /> LOCAL WORKSPACE</span><PrivacyNote /></div>
      </div>
      <div className="section-heading"><h2><span>01</span> Source documents</h2><span>Strict JSON<span className="footer-separator">·</span>Up to 1 MiB per document</span></div>
      <div className="editors-grid">
        <JsonEditor side="original" value={inputs.original} validation={originalValidation} onChange={value => dispatch({ type: 'edit', side: 'original', value })} onReplace={value => dispatch({ type: 'replace-side', side: 'original', value })} onCopy={copy} notify={notify} />
        <JsonEditor side="modified" value={inputs.modified} validation={modifiedValidation} onChange={value => dispatch({ type: 'edit', side: 'modified', value })} onReplace={value => dispatch({ type: 'replace-side', side: 'modified', value })} onCopy={copy} notify={notify} />
      </div>
      <CompareToolbar canCompare={canCompare} hasInput={hasInput} canUndo={undo !== null}
        onCompare={compare} onSwap={() => dispatch({ type: 'swap' })} onExample={loadExample}
        onClear={() => { replace({ original: '', modified: '' }); notify('Both editors cleared. Use Undo to restore your JSON.') }} onUndo={() => { dispatch({ type: 'undo' }); notify('Previous inputs restored.') }} />
      <div className="section-heading results-section-heading"><h2><span>02</span> The difference</h2><span className="keyboard-hint"><Command size={11} /> / Ctrl + <CornerDownLeft size={11} /> to compare</span></div>
      <DiffViewer key={comparison?.id ?? 'empty'} result={comparison?.result ?? null} stale={stale} onCopy={copy} onExample={loadExample} />
      <footer className="workspace-footer"><span><ShieldCheck size={13} /> Private by design. No uploads, no tracking, no account.</span><a href="https://github.com/pulkitdotio/json-diff-studio#comparison-behavior" target="_blank" rel="noreferrer">How comparison works <span>↗</span></a></footer>
    </main>
    {toast && <div className={`toast ${toast.error ? 'toast-error' : ''}`} role={toast.error ? 'alert' : 'status'} key={toast.id}>
      {toast.error ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}<span>{toast.message}</span><button className="icon-button small" aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={15} /></button>
    </div>}
  </>
}
