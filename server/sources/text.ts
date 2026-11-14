/** Strip HTML tags and decode the handful of entities book APIs actually use. */
export function plainText(input: string | null | undefined): string | null {
  if (!input) return null
  const text = input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text.length > 0 ? text : null
}

/**
 * Open Library descriptions often end with a "----------" block of source links
 * and use markdown links. Keep the prose, drop the plumbing.
 */
export function cleanOpenLibraryDescription(input: unknown): string | null {
  const raw =
    typeof input === 'string'
      ? input
      : input && typeof input === 'object' && 'value' in input && typeof input.value === 'string'
        ? input.value
        : null
  if (!raw) return null
  const prose = raw
    .split(/\r?\n-{3,}/)[0]!
    .replace(/\(\[source\]\[\d+\]\)/gi, '')
    .replace(/\[([^\]]+)\]\[\d+\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*\[\d+\]:.*$/gm, '')
    // Wikipedia citation marks copied in with the text: "[3]".
    .replace(/\[\d+\]/g, '')
    // Markdown emphasis: **bold**, __bold__, *italic*, _italic_.
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2')
    .replace(/(^|[\s(“"'])[*_](?=\S)([^*_\n]*?\S)[*_](?=[\s).,;:!?”"']|$)/g, '$1$2')
  return plainText(prose)
}

export function yearFrom(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const match = value?.match(/\d{4}/)
  return match ? Number(match[0]) : null
}

export function isbn13From(values: readonly string[] | undefined): string | null {
  return values?.find((value) => /^97[89]\d{10}$/.test(value)) ?? null
}
