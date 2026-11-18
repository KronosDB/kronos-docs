"use client"

import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react"
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react"

export type ExplainerStep = {
  /** Short noun phrase shown above the caption. */
  title: string
  /** What the viewer reads while the step plays. */
  caption: ReactNode
  /** How long the step plays, in milliseconds. */
  duration?: number
}

const DEFAULT_DURATION = 7000

/**
 * A step-through animation with video-like controls. The stage is an SVG that
 * `children` draws for the current step; elements move between steps with CSS
 * transitions, so a stage only has to say where things are at each step.
 */
export function Explainer({
  title,
  steps,
  viewBox = "0 0 800 440",
  children,
}: {
  title: string
  steps: ReadonlyArray<ExplainerStep>
  viewBox?: string
  children: (step: number) => ReactNode
}) {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const captionId = useId()
  const last = steps.length - 1
  const ended = step === last && !playing && started

  const go = useCallback(
    (next: number) => {
      setStarted(true)
      setStep(Math.max(0, Math.min(last, next)))
    },
    [last],
  )

  const toggle = useCallback(() => {
    setStarted(true)
    if (playing) return setPlaying(false)
    if (step === last) setStep(0)
    setPlaying(true)
  }, [playing, step, last])

  // Pause when the player scrolls out of view.
  useEffect(() => {
    const element = root.current
    if (!element || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry && !entry.isIntersecting) setPlaying(false)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const onStepEnd = () => {
    if (step < last) setStep(step + 1)
    else setPlaying(false)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === " " || event.key === "k") {
      event.preventDefault()
      toggle()
    } else if (event.key === "ArrowRight") {
      event.preventDefault()
      setPlaying(false)
      go(step + 1)
    } else if (event.key === "ArrowLeft") {
      event.preventDefault()
      setPlaying(false)
      go(step - 1)
    }
  }

  const current = steps[step]!

  return (
    <figure
      ref={root}
      className="kx not-prose my-6 overflow-hidden rounded-xl border bg-fd-card text-fd-card-foreground"
      aria-label={title}
      aria-describedby={captionId}
      data-playing={playing ? "true" : "false"}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div className="relative">
        <div className="overflow-x-auto">
          <svg
            viewBox={viewBox}
            className="block h-auto w-full min-w-[680px]"
            role="img"
            aria-label={`${title}: ${current.title}`}
          >
            {children(step)}
          </svg>
        </div>
        {!started && (
          <button
            type="button"
            onClick={toggle}
            className="absolute inset-0 flex items-center justify-center bg-fd-background/40 transition-colors hover:bg-fd-background/20"
            aria-label={`Play: ${title}`}
          >
            <span className="flex size-16 items-center justify-center rounded-full bg-fd-primary text-fd-primary-foreground shadow-lg">
              <Play className="ml-1 size-7" />
            </span>
          </button>
        )}
      </div>

      <div className="border-t px-4 pt-3 pb-4">
        <div className="mb-3 flex gap-1" role="group" aria-label="Steps">
          {steps.map((item, index) => (
            <button
              key={item.title}
              type="button"
              onClick={() => {
                setPlaying(false)
                go(index)
              }}
              className="group relative h-1.5 flex-1 overflow-hidden rounded-full bg-fd-muted"
              aria-label={`Step ${index + 1}: ${item.title}`}
              aria-current={index === step ? "step" : undefined}
            >
              {index < step && <span className="absolute inset-0 bg-fd-primary" />}
              {index === step && (
                <span
                  key={`${step}-${started}`}
                  className="kx-fill absolute inset-y-0 left-0 bg-fd-primary"
                  style={{
                    animationDuration: `${item.duration ?? DEFAULT_DURATION}ms`,
                    animationPlayState: playing ? "running" : "paused",
                    width: started ? undefined : "0%",
                  }}
                  onAnimationEnd={playing ? onStepEnd : undefined}
                />
              )}
              <span className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100 group-hover:bg-fd-foreground/10" />
            </button>
          ))}
        </div>

        <div className="flex items-start gap-3">
          <div className="flex shrink-0 items-center gap-1">
            <ControlButton label="Previous step" onClick={() => (setPlaying(false), go(step - 1))} disabled={step === 0}>
              <SkipBack className="size-4" />
            </ControlButton>
            <ControlButton label={playing ? "Pause" : ended ? "Replay" : "Play"} onClick={toggle} primary>
              {playing ? <Pause className="size-4" /> : ended ? <RotateCcw className="size-4" /> : <Play className="size-4" />}
            </ControlButton>
            <ControlButton label="Next step" onClick={() => (setPlaying(false), go(step + 1))} disabled={step === last}>
              <SkipForward className="size-4" />
            </ControlButton>
          </div>
          <figcaption id={captionId} className="min-w-0 flex-1" aria-live="polite">
            <p className="text-sm font-medium">
              <span className="text-fd-muted-foreground tabular-nums">
                {step + 1}/{steps.length}
              </span>{" "}
              {current.title}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-fd-muted-foreground">{current.caption}</p>
          </figcaption>
        </div>
      </div>
    </figure>
  )
}

function ControlButton({
  label,
  onClick,
  disabled,
  primary,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  primary?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={
        primary
          ? "flex size-9 items-center justify-center rounded-full bg-fd-primary text-fd-primary-foreground transition-opacity hover:opacity-90"
          : "flex size-8 items-center justify-center rounded-full text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground disabled:opacity-30 disabled:hover:bg-transparent"
      }
    >
      {children}
    </button>
  )
}
