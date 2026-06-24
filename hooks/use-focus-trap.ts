import { useEffect, useRef } from 'react'

export interface UseFocusTrapOptions {
  enabled: boolean
  onEscape?: () => void
  /** When the trap is deactivated, focus is restored to this element. */
  returnFocusRef?: React.RefObject<HTMLElement>
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function useFocusTrap({ enabled, onEscape, returnFocusRef }: UseFocusTrapOptions) {
  const containerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!enabled) return

    const container = containerRef.current
    if (!container) return

    const getFocusableElements = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
      )

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEscape?.()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = getFocusableElements()
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement

      if (event.shiftKey) {
        // Shift+Tab: if focus is on first element, wrap to last
        if (active === first) {
          event.preventDefault()
          last.focus()
        }
      } else {
        // Tab: if focus is on last element, wrap to first
        if (active === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    // Move focus into the container on mount if focus is currently outside it
    if (!container.contains(document.activeElement)) {
      const focusable = getFocusableElements()
      if (focusable.length > 0) {
        focusable[0].focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // Restore focus to the designated return target when the trap deactivates
      returnFocusRef?.current?.focus()
    }
  }, [enabled, onEscape, returnFocusRef])

  return containerRef
}
