import { validateJson } from './jsonValidation'

/** Indent tokens without rewriting numbers, string escapes, or duplicate keys. */
export function formatJson(source: string): string {
  if (validateJson(source).status !== 'valid') return source
  const tokens = source.match(/"(?:[^"\\]|\\.)*"|[{}[\],:]|[^\s{}[\],:]+/g) ?? []
  let depth = 0
  let output = ''
  const newline = () => '\n' + '  '.repeat(depth)
  tokens.forEach((token, index) => {
    if (token === '{' || token === '[') {
      output += token
      if (tokens[index + 1] !== (token === '{' ? '}' : ']')) { depth++; output += newline() }
    } else if (token === '}' || token === ']') {
      if (tokens[index - 1] !== (token === '}' ? '{' : '[')) { depth--; output += newline() }
      output += token
    } else if (token === ',') output += ',' + newline()
    else if (token === ':') output += ': '
    else output += token
  })
  return output
}
