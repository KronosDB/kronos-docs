"use client"

import { Pause, Play } from "lucide-react"
import { type ReactNode, useEffect, useRef, useState } from "react"

/**
 * A small looping animation that illustrates one idea next to the paragraph
 * that explains it. `children` draws the frame for the current phase; elements
 * move between phases with CSS transitions (`.kx-move`).
 *
 * It plays while it is on screen and pauses when scrolled away or when the
 * reader presses pause. With reduced motion it shows the final phase and does
 * not play.
 */
export function Animation({
  label,
  phases,
  ms = 1400,
  hold = 2600,
  viewBox,
  children,
}: {
  /** What the animation shows, for screen readers. */
  label: string
  /** Number of phases; the last one is the finished picture. */
  phases: number
  /** How long each phase lasts, in milliseconds. */
  ms?: number
  /** How long the finished picture stays before the loop restarts. */
  hold?: number
  viewBox: string
  children: (phase: number) => ReactNode
}) {
  const last = phases - 1
  const [phase, setPhase] = useState(last)
  const [visible, setVisible] = useState(false)
  const [paused, setPaused] = useState(false)
  const [reduced, setReduced] = useState(false)
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(query.matches)
    const onChange = () => setReduced(query.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])

  useEffect(() => {
    const element = root.current
    if (!element || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), {
      threshold: 0.5,
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const running = visible && !paused && !reduced

  useEffect(() => {
    if (!running) return
    const timer = setTimeout(() => setPhase((current) => (current >= last ? 0 : current + 1)), phase >= last ? hold : ms)
    return () => clearTimeout(timer)
  }, [running, phase, last, ms, hold])

  useEffect(() => {
    if (reduced) setPhase(last)
  }, [reduced, last])

  return (
    <figure
      ref={root}
      className="kx not-prose relative my-6 rounded-xl border bg-fd-card px-2 py-3"
      aria-label={label}
      data-playing={running ? "true" : "false"}
    >
      <svg viewBox={viewBox} className="block h-auto w-full" role="img" aria-label={label}>
        {children(phase)}
      </svg>
      {!reduced && (
        <button
          type="button"
          onClick={() => setPaused((value) => !value)}
          className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
          aria-label={paused ? "Play animation" : "Pause animation"}
          title={paused ? "Play" : "Pause"}
        >
          {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
        </button>
      )}
    </figure>
  )
}
