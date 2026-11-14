import { describe, expect, it } from 'vitest'
import { cleanOpenLibraryDescription } from './text'

describe('cleanOpenLibraryDescription', () => {
  it('drops Markdown emphasis and Wikipedia citation marks', () => {
    expect(
      cleanOpenLibraryDescription(
        '**From the *New York Times* bestselling author of _Jonathan Strange_**, a novel.',
      ),
    ).toBe('From the New York Times bestselling author of Jonathan Strange, a novel.')
    expect(cleanOpenLibraryDescription('Born 20 September 1974,[3] she is a novelist.[12]')).toBe(
      'Born 20 September 1974, she is a novelist.',
    )
  })

  it('leaves ordinary punctuation alone', () => {
    const text = 'Rated 5 * 3 = 15; snake_case_word and a lone * star.'
    expect(cleanOpenLibraryDescription(text)).toBe(text)
  })

  it('still strips source blocks and link syntax', () => {
    expect(
      cleanOpenLibraryDescription({
        type: '/type/text',
        value:
          'A [famous](https://x.example) book ([source][1])\n----------\n[1]: https://x.example',
      }),
    ).toBe('A famous book')
  })
})
