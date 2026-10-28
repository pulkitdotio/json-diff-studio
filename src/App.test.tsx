import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { MAX_BYTES } from './lib/jsonValidation'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open') } })
})

function editors() { return { original: screen.getByRole('textbox', { name: 'Original JSON' }), modified: screen.getByRole('textbox', { name: 'Modified JSON' }) } }
function enterJson(original: string, modified: string) {
  const fields = editors()
  fireEvent.change(fields.original, { target: { value: original } })
  fireEvent.change(fields.modified, { target: { value: modified } })
}
function compare() { fireEvent.click(screen.getByRole('button', { name: /Compare JSON/ })) }

describe('workspace workflows', () => {
  it('starts with useful instructions and disabled comparison', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /Compare JSON/ })).toBeDisabled()
    expect(screen.getByText('A little clarity for your JSON.')).toBeInTheDocument()
    expect(screen.getAllByText('Waiting for JSON')).toHaveLength(2)
  })

  it('validates inputs independently and never formats invalid input', () => {
    render(<App />)
    enterJson('{"a":1}', '{"a":}')
    expect(screen.getByText('Valid JSON')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Modified JSON' })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('button', { name: 'Format Modified JSON' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Compare JSON/ })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent(/JSON|Unexpected|Expected/)
  })

  it('compares, filters without changing statistics, and toggles unchanged values', () => {
    render(<App />)
    enterJson('{"same":1,"gone":0,"edit":1}', '{"same":1,"new":null,"edit":2}')
    compare()
    expect(screen.getByLabelText('Difference statistics')).toHaveTextContent('3Total changes1Added1Removed1Modified')
    expect(screen.getByRole('table')).not.toHaveTextContent('"same"')
    fireEvent.click(screen.getByRole('button', { name: /^Added 1$/ }))
    expect(screen.getByRole('table')).toHaveTextContent('"new"')
    expect(screen.getByRole('table')).not.toHaveTextContent('"gone"')
    expect(screen.getByLabelText('Difference statistics')).toHaveTextContent('3Total changes')
    fireEvent.click(screen.getByRole('button', { name: /^Removed 1$/ }))
    expect(screen.getByRole('table')).toHaveTextContent('"gone"')
    expect(screen.getByRole('table')).not.toHaveTextContent('"new"')
    fireEvent.click(screen.getByRole('button', { name: /^Modified 1$/ }))
    expect(screen.getByRole('table')).toHaveTextContent('"edit"')
    fireEvent.click(screen.getByRole('button', { name: /^All changes 3$/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show unchanged' }))
    expect(screen.getByRole('table')).toHaveTextContent('"same"')
  })

  it('loads a working example, expands and collapses nodes, and inspects full values', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Load example' }))
    expect(screen.getByLabelText('Difference statistics')).toHaveTextContent('9Total changes3Added1Removed5Modified')
    const collapse = screen.getByRole('button', { name: 'Collapse /server' })
    fireEvent.click(collapse)
    expect(screen.queryByRole('button', { name: '"port"' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Expand /server' }))
    fireEvent.click(screen.getByRole('button', { name: '"port"' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('/server/port')
    expect(dialog).toHaveTextContent('8080')
    expect(dialog).toHaveTextContent('443')
    fireEvent.click(within(dialog).getByRole('button', { name: /Close/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all nodes' }))
    expect(screen.getAllByRole('row')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Expand all nodes' }))
    expect(screen.getAllByRole('row').length).toBeGreaterThan(2)
  })

  it('marks previous results stale after editing and refreshes with Ctrl+Enter', () => {
    render(<App />)
    enterJson('1', '2')
    compare()
    fireEvent.change(editors().modified, { target: { value: '1' } })
    expect(screen.getByText('Out of date')).toBeInTheDocument()
    expect(screen.getByText(/Inputs have changed/)).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true })
    expect(screen.queryByText('Out of date')).not.toBeInTheDocument()
    expect(screen.getByText('Perfect match.')).toBeInTheDocument()
  })

  it('swaps, clears, and restores previous input through Undo', () => {
    render(<App />)
    enterJson('1', '2')
    fireEvent.click(screen.getByRole('button', { name: /Swap inputs/ }))
    expect(editors().original).toHaveValue('2')
    expect(editors().modified).toHaveValue('1')
    fireEvent.click(screen.getByRole('button', { name: 'Clear both' }))
    expect(editors().original).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(editors().original).toHaveValue('2')
    fireEvent.click(screen.getByRole('button', { name: 'Clear Original JSON' }))
    expect(editors().original).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(editors().original).toHaveValue('2')
  })

  it('formats valid JSON and lets keyboard users tab out of the editor', async () => {
    const user = userEvent.setup()
    render(<App />)
    enterJson('{"a":1}', 'null')
    fireEvent.click(screen.getByRole('button', { name: 'Format Original JSON' }))
    expect(editors().original).toHaveValue('{\n  "a": 1\n}')
    editors().original.focus()
    await user.tab()
    expect(editors().original).not.toHaveFocus()
  })

  it('copies both inputs and a structured report, and reports clipboard failures', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(<App />)
    enterJson('null', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Copy Original JSON' }))
    expect(await screen.findByText('Original JSON copied to clipboard.')).toBeInTheDocument()
    expect(writeText).toHaveBeenLastCalledWith('null')
    fireEvent.click(screen.getByRole('button', { name: 'Copy Modified JSON' }))
    expect(await screen.findByText('Modified JSON copied to clipboard.')).toBeInTheDocument()
    expect(writeText).toHaveBeenLastCalledWith('false')
    compare()
    fireEvent.click(screen.getByRole('button', { name: 'Copy report' }))
    expect(await screen.findByText('Diff report copied to clipboard.')).toBeInTheDocument()
    expect(JSON.parse(writeText.mock.calls.at(-1)![0]).counts.modified).toBe(1)
    writeText.mockRejectedValueOnce(new Error('denied'))
    fireEvent.click(screen.getByRole('button', { name: 'Copy report' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not copy')
  })

  it('reads a JSON file locally and surfaces validation errors for invalid files', async () => {
    render(<App />)
    const file = new File(['{"file":true}'], 'sample.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => '{"file":true}' })
    fireEvent.change(screen.getByLabelText('Original JSON file'), { target: { files: [file] } })
    expect(await screen.findByText('sample.json loaded into original json.')).toBeInTheDocument()
    expect(editors().original).toHaveValue('{"file":true}')
    const invalidFile = new File(['{bad}'], 'invalid.json')
    Object.defineProperty(invalidFile, 'text', { value: async () => '{bad}' })
    fireEvent.change(screen.getByLabelText('Modified JSON file'), { target: { files: [invalidFile] } })
    expect(await screen.findByText('Invalid JSON')).toBeInTheDocument()
    expect(editors().modified).toHaveValue('{bad}')
  })

  it('rejects oversized, wrong-extension, and unreadable files without replacing input', async () => {
    render(<App />)
    enterJson('1', '2')
    const field = screen.getByLabelText('Original JSON file')
    fireEvent.change(field, { target: { files: [new File(['{}'], 'data.txt')] } })
    expect(screen.getByRole('alert')).toHaveTextContent('.json extension')
    const big = new File([''], 'big.json')
    Object.defineProperty(big, 'size', { value: MAX_BYTES + 1 })
    fireEvent.change(field, { target: { files: [big] } })
    expect(screen.getByRole('alert')).toHaveTextContent('1 MiB')
    const bad = new File([''], 'unreadable.json')
    Object.defineProperty(bad, 'text', { value: async () => { throw new Error('read failed') } })
    fireEvent.change(field, { target: { files: [bad] } })
    expect(await screen.findByText('This file could not be read. Try selecting it again.')).toBeInTheDocument()
    expect(editors().original).toHaveValue('1')
  })

  it('rejects oversized pasted input and preserves the previous document', () => {
    render(<App />)
    enterJson('1', '2')
    fireEvent.change(editors().original, { target: { value: 'x'.repeat(MAX_BYTES + 1) } })
    expect(editors().original).toHaveValue('1')
    expect(screen.getByRole('alert')).toHaveTextContent('Your previous JSON has been kept')
  })

  it('preserves edits to the other editor while a file read is pending', async () => {
    render(<App />)
    enterJson('1', '2')
    let finishRead!: (text: string) => void
    const pending = new Promise<string>(resolve => { finishRead = resolve })
    const file = new File(['3'], 'pending.json')
    Object.defineProperty(file, 'text', { value: () => pending })
    fireEvent.change(screen.getByLabelText('Original JSON file'), { target: { files: [file] } })
    fireEvent.change(editors().modified, { target: { value: '4' } })
    await act(async () => { finishRead('3'); await pending })
    expect(editors().original).toHaveValue('3')
    expect(editors().modified).toHaveValue('4')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(editors().original).toHaveValue('1')
    expect(editors().modified).toHaveValue('4')
  })

  it('discards a pending file read if its target was swapped in the meantime', async () => {
    render(<App />)
    enterJson('1', '2')
    let finishRead!: (text: string) => void
    const pending = new Promise<string>(resolve => { finishRead = resolve })
    const file = new File(['3'], 'pending.json')
    Object.defineProperty(file, 'text', { value: () => pending })
    fireEvent.change(screen.getByLabelText('Original JSON file'), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: 'Swap inputs' }))
    await act(async () => { finishRead('3'); await pending })
    expect(editors().original).toHaveValue('2')
    expect(editors().modified).toHaveValue('1')
  })

  it('switches themes and stores only the theme preference', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(localStorage.getItem('json-diff-theme')).toBe('light')
    enterJson('{"private":true}', '{}')
    expect(localStorage.length).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })

  it('handles a filter with no matching changes', () => {
    render(<App />)
    enterJson('1', '2')
    compare()
    fireEvent.click(screen.getByRole('button', { name: 'Added 0' }))
    expect(screen.getByText('No added changes to display.')).toBeInTheDocument()
  })

  it('limits initial rendered rows and reveals more on request', () => {
    render(<App />)
    enterJson('[]', JSON.stringify(Array.from({ length: 450 }, (_, index) => index)))
    compare()
    expect(within(screen.getByRole('table')).getAllByRole('row', { hidden: true })).toHaveLength(401)
    fireEvent.click(screen.getByRole('button', { name: /Show 400 more/ }))
    expect(within(screen.getByRole('table')).getAllByRole('row', { hidden: true })).toHaveLength(452)
  })
})
