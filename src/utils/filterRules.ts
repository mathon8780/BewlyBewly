export function compileFilterKeywords(entries: { keyword: string }[]) {
  const exact = new Set<string>()
  const patterns: RegExp[] = []
  for (const { keyword } of entries) {
    if (!keyword)
      continue
    if (keyword.startsWith('/') && keyword.endsWith('/')) {
      try {
        patterns.push(new RegExp(keyword.slice(1, -1), 'i'))
      }
      catch {
        // Ignore incomplete/invalid expressions while the user edits a rule.
      }
    }
    else {
      exact.add(keyword.toUpperCase())
    }
  }
  return { exact, fragments: [...exact], patterns }
}
