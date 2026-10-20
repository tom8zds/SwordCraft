import { useSyncExternalStore } from 'react'

export const COMPACT_LAYOUT_QUERY = '(max-width: 700px), (max-height: 550px)'

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const media = window.matchMedia(COMPACT_LAYOUT_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function getSnapshot() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(COMPACT_LAYOUT_QUERY).matches
    : false
}

export function useCompactLayout() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
