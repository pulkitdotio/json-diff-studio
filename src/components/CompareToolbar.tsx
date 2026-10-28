import { ArrowLeftRight, ArrowRight, FlaskConical, RotateCcw, Trash2 } from 'lucide-react'

interface Props {
  canCompare: boolean
  hasInput: boolean
  canUndo: boolean
  onCompare: () => void
  onSwap: () => void
  onExample: () => void
  onClear: () => void
  onUndo: () => void
}

export function CompareToolbar(props: Props) {
  return <div className="compare-toolbar">
    <div className="toolbar-utilities">
      <button className="text-button" onClick={props.onExample}><FlaskConical size={15} /> Load example</button>
      <button className="text-button" onClick={props.onSwap} disabled={!props.hasInput}><ArrowLeftRight size={15} /> Swap inputs</button>
      <span className="small-divider" />
      <button className="text-button muted-button" onClick={props.onClear} disabled={!props.hasInput}><Trash2 size={15} /> Clear both</button>
      {props.canUndo && <button className="text-button undo-button" onClick={props.onUndo}><RotateCcw size={14} /> Undo</button>}
    </div>
    <button className="compare-button" onClick={props.onCompare} disabled={!props.canCompare}>
      Compare JSON <kbd>Ctrl ↵</kbd><ArrowRight size={17} />
    </button>
  </div>
}
