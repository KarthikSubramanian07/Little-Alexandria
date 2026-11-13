import { useCallback, useSyncExternalStore } from 'react'

export type ThemeChoice = 'light' | 'dark' | 'system'
const KEY = 'la-theme'
const listeners = new Set<() => void>()

function read(): ThemeChoice {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

const media = () => window.matchMedia('(prefers-color-scheme: dark)')

/** The theme actually on screen, resolving "system" against the OS. */
export function resolvedTheme(choice = read()): 'light' | 'dark' {
  if (choice !== 'system') return choice
  return media().matches ? 'dark' : 'light'
}

function apply(choice: ThemeChoice) {
  const root = document.documentElement
  if (choice === 'system') delete root.dataset.theme
  else root.dataset.theme = choice
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])')
  if (meta) meta.content = resolvedTheme(choice) === 'dark' ? '#16110d' : '#f3ecdd'
}

export function useTheme() {
  const choice = useSyncExternalStore(
    (notify) => {
      listeners.add(notify)
      const query = media()
      query.addEventListener('change', notify)
      return () => {
        listeners.delete(notify)
        query.removeEventListener('change', notify)
      }
    },
    read,
    () => 'system' as ThemeChoice,
  )
  const setChoice = useCallback((next: ThemeChoice) => {
    try {
      if (next === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, next)
    } catch {
      // Private mode: the choice lasts for this page only.
    }
    apply(next)
    listeners.forEach((notify) => notify())
  }, [])
  return { choice, resolved: resolvedTheme(choice), setChoice }
}
