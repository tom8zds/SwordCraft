import { forwardRef, useCallback, useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'

interface BookScrollProps {
  children: ReactNode
  className?: string
  viewportClassName?: string
  ariaLabel: string
  style?: CSSProperties
}

interface ThumbState {
  top: number
  height: number
  scrollable: boolean
}

/** 书本/商店共用的真实滚动视口与墨金色滚动轨道。 */
export const BookScroll = forwardRef<HTMLDivElement, BookScrollProps>(function BookScroll({
  children,
  className = '',
  viewportClassName = '',
  style,
  ariaLabel,
}, forwardedRef) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; startY: number; startScroll: number } | null>(null)
  const viewportId = useId()
  const [thumb, setThumb] = useState<ThumbState>({ top: 0, height: 100, scrollable: false })

  const setViewportRef = useCallback((node: HTMLDivElement | null) => {
    viewportRef.current = node
    if (typeof forwardedRef === 'function') forwardedRef(node)
    else if (forwardedRef) forwardedRef.current = node
  }, [forwardedRef])

  const cancelDrag = useCallback(() => {
    const pointerId = dragRef.current?.pointerId
    dragRef.current = null
    if (pointerId !== undefined && thumbRef.current?.hasPointerCapture(pointerId)) thumbRef.current.releasePointerCapture(pointerId)
  }, [])

  const updateThumb = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
    if (!maxScroll) {
      setThumb({ top: 0, height: 100, scrollable: false })
      return
    }
    const height = Math.max(12, Math.min(100, (viewport.clientHeight / viewport.scrollHeight) * 100))
    setThumb({ top: (viewport.scrollTop / maxScroll) * (100 - height), height, scrollable: true })
  }, [])

  const scrollToRatio = useCallback((ratio: number) => {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.scrollTop = Math.max(0, Math.min(1, ratio)) * Math.max(0, viewport.scrollHeight - viewport.clientHeight)
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return
    const observer = new ResizeObserver(updateThumb)
    observer.observe(viewport)
    observer.observe(content)
    viewport.addEventListener('scroll', updateThumb, { passive: true })
    updateThumb()
    return () => {
      observer.disconnect()
      viewport.removeEventListener('scroll', updateThumb)
    }
  }, [children, updateThumb])

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current
      const viewport = viewportRef.current
      const rail = railRef.current
      if (!drag || !viewport || !rail || event.pointerId !== drag.pointerId) return
      const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
      const thumbPixels = rail.clientHeight * thumb.height / 100
      const travel = Math.max(1, rail.clientHeight - thumbPixels)
      viewport.scrollTop = drag.startScroll + ((event.clientY - drag.startY) / travel) * maxScroll
    }
    const endDrag = (event: PointerEvent) => {
      if (dragRef.current?.pointerId === event.pointerId) cancelDrag()
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', endDrag)
    document.addEventListener('pointercancel', endDrag)
    window.addEventListener('blur', cancelDrag)
    return () => {
      cancelDrag()
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', endDrag)
      document.removeEventListener('pointercancel', endDrag)
      window.removeEventListener('blur', cancelDrag)
    }
  }, [cancelDrag, thumb.height])

  const handleThumbDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current
    if (!viewport || !thumb.scrollable || !event.isPrimary || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    railRef.current?.focus({ preventScroll: true })
    dragRef.current = { pointerId: event.pointerId, startY: event.clientY, startScroll: viewport.scrollTop }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleTrackDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!thumb.scrollable || event.target === thumbRef.current || !event.isPrimary || event.button !== 0) return
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    const track = event.currentTarget.getBoundingClientRect()
    const thumbPixels = track.height * thumb.height / 100
    scrollToRatio((event.clientY - track.top - thumbPixels / 2) / Math.max(1, track.height - thumbPixels))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current
    if (!viewport || !thumb.scrollable) return
    const page = Math.max(40, viewport.clientHeight * .85)
    if (event.key === 'Home') viewport.scrollTop = 0
    else if (event.key === 'End') viewport.scrollTop = viewport.scrollHeight
    else if (event.key === 'PageUp') viewport.scrollTop -= page
    else if (event.key === 'PageDown') viewport.scrollTop += page
    else if (event.key === 'ArrowUp') viewport.scrollTop -= 40
    else if (event.key === 'ArrowDown') viewport.scrollTop += 40
    else return
    event.preventDefault()
    event.stopPropagation()
    updateThumb()
  }

  const railStyle = {
    '--book-thumb-top': `${thumb.top}%`,
    '--book-thumb-height': `${thumb.height}%`,
  } as CSSProperties
  const valueNow = thumb.scrollable ? Math.round((thumb.top / Math.max(1, 100 - thumb.height)) * 100) : 0

  return (
    <div className={`book-scroll ${className}`.trim()} style={style}>
      <div
        ref={setViewportRef}
        id={viewportId}
        className={`book-scroll-viewport ${viewportClassName}`.trim()}
        tabIndex={0}
        aria-label={ariaLabel}
      >
        <div ref={contentRef} className="book-scroll-content">{children}</div>
      </div>
      <div
        ref={railRef}
        className={`book-scroll-rail${thumb.scrollable ? '' : ' is-static'}`}
        role="scrollbar"
        tabIndex={thumb.scrollable ? 0 : -1}
        aria-disabled={!thumb.scrollable}
        aria-label={`${ariaLabel}滚动条`}
        aria-controls={viewportId}
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={valueNow}
        style={railStyle}
        onPointerDown={handleTrackDown}
        onKeyDown={handleKeyDown}
        onBlur={cancelDrag}
      >
        <div ref={thumbRef} className="book-scroll-thumb" onPointerDown={handleThumbDown} onLostPointerCapture={cancelDrag} />
      </div>
    </div>
  )
})
