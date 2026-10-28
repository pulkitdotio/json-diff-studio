import { Equal, Minus, Plus, RefreshCw } from 'lucide-react'
import type { DiffResult } from '../types/json'

export function DiffSummary({ counts }: { counts: DiffResult['counts'] }) {
  return <div className="diff-summary" aria-label="Difference statistics">
    <div className="stat stat-total"><span className="stat-icon"><Equal size={17} /></span><strong>{counts.total.toLocaleString()}</strong><span>Total changes</span></div>
    <div className="stat added"><span className="stat-icon"><Plus size={17} /></span><strong>{counts.added.toLocaleString()}</strong><span>Added</span></div>
    <div className="stat removed"><span className="stat-icon"><Minus size={17} /></span><strong>{counts.removed.toLocaleString()}</strong><span>Removed</span></div>
    <div className="stat modified"><span className="stat-icon"><RefreshCw size={15} /></span><strong>{counts.modified.toLocaleString()}</strong><span>Modified</span></div>
  </div>
}
