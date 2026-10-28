import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, CheckCircle2, Copy, FileJson2, ListFilter, Trash2, Upload } from 'lucide-react'
import type { Validation } from '../types/json'
import { formatJson } from '../lib/jsonFormatting'
import { MAX_BYTES } from '../lib/jsonValidation'

interface Props {
  side: 'original' | 'modified'
  value: string
  validation: Validation
  onChange: (value: string) => void
  onReplace: (value: string) => void
  onCopy: (text: string, label: string) => Promise<boolean>
  notify: (message: string, error?: boolean) => void
}

export function JsonEditor({ side, value, validation, onChange, onReplace, onCopy, notify }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const readVersion = useRef(0)
  const [scrollTop, setScrollTop] = useState(0)
  const [copied, setCopied] = useState(false)
  useEffect(() => { readVersion.current++ }, [value])
  const title = side === 'original' ? 'Original JSON' : 'Modified JSON'
  const lineCount = value.split('\n').length
  const firstLine = Math.floor(scrollTop / 22)
  const lines = Array.from({ length: Math.max(0, Math.min(30, lineCount - firstLine)) }, (_, index) => firstLine + index + 1)

  async function upload(file?: File) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.json')) { notify('Choose a file with a .json extension.', true); return }
    if (file.size > MAX_BYTES) { notify('This file exceeds the 1 MiB size limit.', true); return }
    const version = ++readVersion.current
    try {
      const text = await file.text()
      if (version !== readVersion.current) return
      onReplace(text)
      notify(`${file.name} loaded into ${title.toLowerCase()}.`)
    } catch { notify('This file could not be read. Try selecting it again.', true) }
  }

  return <section className={`editor-panel ${validation.status === 'invalid' ? 'editor-invalid' : ''}`} aria-labelledby={`${side}-title`}>
    <div className="editor-header">
      <div className="editor-title"><span className={`document-dot ${side}`} /><h2 id={`${side}-title`}>{title}</h2><span className="document-tag">{side === 'original' ? 'BEFORE' : 'AFTER'}</span></div>
      <span className="file-type"><FileJson2 size={13} /> JSON</span>
    </div>
    <div className="editor-actions">
      <button className="editor-action" onClick={() => inputRef.current?.click()} aria-label={`Upload ${title}`}><Upload size={14} /> Upload file</button>
      <button className="editor-action" disabled={validation.status !== 'valid'} onClick={() => { onChange(formatJson(value)); notify(`${title} formatted with 2-space indentation.`) }} aria-label={`Format ${title}`}><ListFilter size={14} /> Format</button>
      <div className="flex-1" />
      <button className="icon-button small" disabled={!value} aria-label={`Copy ${title}`} title="Copy JSON" onClick={async () => { const success = await onCopy(value, title); setCopied(success); window.setTimeout(() => setCopied(false), 1800) }}>{copied ? <Check size={14} /> : <Copy size={14} />}</button>
      <button className="icon-button small" disabled={!value} aria-label={`Clear ${title}`} title="Clear editor" onClick={() => { readVersion.current++; onReplace(''); notify(`${title} cleared. Use Undo to restore your JSON.`) }}><Trash2 size={14} /></button>
      <input ref={inputRef} className="sr-only" tabIndex={-1} type="file" accept=".json,application/json" aria-label={`${title} file`} onChange={event => { void upload(event.target.files?.[0]); event.target.value = '' }} />
    </div>
    <div className="editor-body">
      <div className="line-numbers" aria-hidden="true"><pre style={{ transform: `translateY(-${scrollTop % 22}px)` }}>{lines.join('\n')}</pre></div>
      <textarea id={`${side}-input`} aria-label={title} aria-describedby={`${side}-feedback${validation.status === 'invalid' ? ` ${side}-error` : ''}`} aria-invalid={validation.status === 'invalid'}
        spellCheck={false} autoComplete="off" autoCapitalize="off" wrap="off" value={value}
        placeholder={'{\n  "paste": "your JSON here",\n  "or": "upload a .json file"\n}'}
        onChange={event => {
          const next = event.target.value
          if (next.length > MAX_BYTES || new TextEncoder().encode(next).length > MAX_BYTES) {
            notify('This input exceeds the 1 MiB limit. Your previous JSON has been kept.', true)
            return
          }
          readVersion.current++
          onChange(next)
        }}
        onScroll={event => setScrollTop(event.currentTarget.scrollTop)} />
      {!value && <div className="editor-empty-hint" aria-hidden="true">A starting point for your comparison.</div>}
    </div>
    <div className="editor-footer" id={`${side}-feedback`}>
      <span className={`validation-state ${validation.status}`}>
        {validation.status === 'valid' ? <><CheckCircle2 size={12} /> Valid JSON</> : validation.status === 'invalid' ? <><AlertCircle size={12} /> Invalid JSON</> : <><span className="empty-dot" /> Waiting for JSON</>}
      </span>
      <span>{lineCount.toLocaleString()} {lineCount === 1 ? 'line' : 'lines'}<span className="footer-separator">·</span>{value.length.toLocaleString()} chars</span>
    </div>
    {validation.status === 'invalid' && <div className="validation-error" id={`${side}-error`} role="alert">
      {validation.line && <strong>Line {validation.line}, column {validation.column}: </strong>}{validation.message}
    </div>}
  </section>
}
