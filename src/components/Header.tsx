import { Braces, Github, Moon, ShieldCheck, Sun } from 'lucide-react'

interface Props { theme: string; onToggleTheme: () => void }

export function Header({ theme, onToggleTheme }: Props) {
  return <header className="site-header">
    <a href="#main" className="brand" aria-label="JSON Diff Studio home">
      <span className="brand-mark"><Braces size={22} strokeWidth={2.3} /></span>
      <span>JSON Diff <strong>Studio</strong><span className="brand-version">v1.0</span></span>
    </a>
    <div className="flex items-center gap-3 sm:gap-5">
      <span className="header-local"><span className="live-dot" /> All processing stays local</span>
      <span className="header-divider" />
      <button className="icon-button" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title="Toggle theme">
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <a className="github-link" href="https://github.com/pulkitdotio/json-diff-studio" target="_blank" rel="noreferrer"><Github size={18} /><span>GitHub</span></a>
    </div>
  </header>
}

export function PrivacyNote() {
  return <span className="privacy-note"><ShieldCheck size={15} /> Your data never leaves your browser</span>
}
