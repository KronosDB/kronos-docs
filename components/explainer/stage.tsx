import type { ReactNode } from "react"

/**
 * Drawing primitives for an explainer stage. Every element is placed with a
 * CSS transform and faded with opacity, so changing its props between steps
 * animates the change (see `.kx-move` in global.css).
 */

export type Tone = "plain" | "accent" | "muted" | "ok" | "warn"

const fills: Record<Tone, string> = {
  plain: "var(--color-fd-card)",
  accent: "color-mix(in oklab, var(--color-fd-primary) 18%, var(--color-fd-card))",
  muted: "var(--color-fd-muted)",
  ok: "color-mix(in oklab, var(--color-fd-success) 18%, var(--color-fd-card))",
  warn: "color-mix(in oklab, var(--color-fd-warning) 20%, var(--color-fd-card))",
}

const strokes: Record<Tone, string> = {
  plain: "var(--color-fd-border)",
  accent: "var(--color-fd-primary)",
  muted: "var(--color-fd-border)",
  ok: "var(--color-fd-success)",
  warn: "var(--color-fd-warning)",
}

/** Places its children at (x, y) and fades them in or out. */
export function At({
  x = 0,
  y = 0,
  scale = 1,
  show = true,
  children,
}: {
  x?: number
  y?: number
  scale?: number
  show?: boolean
  children: ReactNode
}) {
  return (
    <g
      className="kx-move"
      style={{ transform: `translate(${x}px, ${y}px) scale(${scale})`, opacity: show ? 1 : 0 }}
      aria-hidden={show ? undefined : true}
    >
      {children}
    </g>
  )
}

/** A labelled rectangle drawn from (0, 0). */
export function Box({
  w,
  h,
  label,
  sub,
  tone = "plain",
  dashed,
  mono,
  align = "center",
}: {
  w: number
  h: number
  label?: ReactNode
  sub?: ReactNode
  tone?: Tone
  dashed?: boolean
  mono?: boolean
  align?: "center" | "top"
}) {
  const labelY = align === "top" ? 20 : sub ? h / 2 - 3 : h / 2 + 5
  return (
    <g>
      <rect
        width={w}
        height={h}
        rx={8}
        className="kx-tone"
        style={{ fill: fills[tone], stroke: strokes[tone] }}
        strokeWidth={tone === "accent" ? 1.5 : 1}
        strokeDasharray={dashed ? "5 4" : undefined}
      />
      {label !== undefined && (
        <text
          x={w / 2}
          y={labelY}
          textAnchor="middle"
          className={mono ? "kx-mono" : undefined}
          style={{ fill: "var(--color-fd-foreground)", fontSize: 13, fontWeight: 500 }}
        >
          {label}
        </text>
      )}
      {sub !== undefined && (
        <text
          x={w / 2}
          y={align === "top" ? 36 : h / 2 + 14}
          textAnchor="middle"
          className="kx-mono"
          style={{ fill: "var(--color-fd-muted-foreground)", fontSize: 10.5 }}
        >
          {sub}
        </text>
      )}
    </g>
  )
}

/** A line of text. */
export function Label({
  x = 0,
  y = 0,
  children,
  muted,
  mono,
  size = 12,
  anchor = "start",
  weight,
}: {
  x?: number
  y?: number
  children: ReactNode
  muted?: boolean
  mono?: boolean
  size?: number
  anchor?: "start" | "middle" | "end"
  weight?: number
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      className={mono ? "kx-mono" : undefined}
      style={{
        fill: muted ? "var(--color-fd-muted-foreground)" : "var(--color-fd-foreground)",
        fontSize: size,
        fontWeight: weight,
      }}
    >
      {children}
    </text>
  )
}

/** A straight arrow from (x1, y1) to (x2, y2). */
export function Arrow({
  x1,
  y1,
  x2,
  y2,
  show = true,
  tone = "muted",
  label,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  show?: boolean
  tone?: "muted" | "accent"
  label?: string
}) {
  const color = tone === "accent" ? "var(--color-fd-primary)" : "var(--color-fd-muted-foreground)"
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const head = 7
  const left = [x2 - head * Math.cos(angle - 0.45), y2 - head * Math.sin(angle - 0.45)]
  const right = [x2 - head * Math.cos(angle + 0.45), y2 - head * Math.sin(angle + 0.45)]
  return (
    <g className="kx-move" style={{ opacity: show ? 1 : 0 }}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} style={{ stroke: color }} strokeWidth={1.5} />
      <polygon points={`${x2},${y2} ${left[0]},${left[1]} ${right[0]},${right[1]}`} style={{ fill: color }} />
      {label && (
        <text
          x={(x1 + x2) / 2}
          y={(y1 + y2) / 2 - 6}
          textAnchor="middle"
          style={{ fill: color, fontSize: 11 }}
        >
          {label}
        </text>
      )}
    </g>
  )
}

/**
 * Plays its children in after `at` milliseconds of a step, or out with `out`.
 * While the player is paused or stepped by hand, the finished state shows at
 * once (see `.kx-reveal` in global.css). Give the enclosing group a `key`
 * that changes when its step starts, so the reveal replays.
 */
export function Reveal({ at, out, children }: { at: number; out?: boolean; children: ReactNode }) {
  return (
    <g className={out ? "kx-vanish" : "kx-reveal"} style={{ animationDelay: `${at}ms` }}>
      {children}
    </g>
  )
}
