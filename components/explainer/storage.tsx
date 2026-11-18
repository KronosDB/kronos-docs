"use client"

import { Animation } from "./animation"
import { Arrow, At, Box, Label } from "./stage"

/** Small animations for the KronosDB storage and indexing page. Each shows one idea. */

const accent = (percent: number) => `color-mix(in oklab, var(--color-fd-primary) ${percent}%, var(--color-fd-card))`

// ── 1. Records fill a segment, which is sealed, and the next one starts ─────

export function SegmentsAnimation() {
  const perSegment = 5
  const recordW = 50
  return (
    <Animation label="Events are appended to the active segment until it is full; it is sealed and a new segment starts." phases={perSegment + 3} ms={700} viewBox="0 0 640 150">
      {(phase) => {
        const sealed = phase >= perSegment + 1
        return (
          <>
            <SegmentFrame x={30} label={sealed ? "S0 · sealed" : "S0 · active"} active={!sealed} />
            {Array.from({ length: perSegment }, (_, index) => (
              <At key={index} x={30 + 8 + index * (recordW + 4)} y={phase > index ? 58 : 18} show={phase > index}>
                <rect width={recordW} height={44} rx={5} style={{ fill: accent(sealed ? 14 : 26) }} className="kx-tone" />
                <Label x={recordW / 2} y={27} size={13} anchor="middle" mono>
                  {index}
                </Label>
              </At>
            ))}
            <At show={sealed}>
              <SegmentFrame x={340} label="S1 · active" active />
              <At x={340 + 8} y={58}>
                <rect width={recordW} height={44} rx={5} style={{ fill: accent(26) }} />
                <Label x={recordW / 2} y={27} size={13} anchor="middle" mono>
                  5
                </Label>
              </At>
            </At>
          </>
        )
      }}
    </Animation>
  )
}

function SegmentFrame({ x, label, active }: { x: number; label: string; active: boolean }) {
  return (
    <g style={{ transform: `translate(${x}px, 0px)` }}>
      <Label y={36} size={13} weight={600}>
        {label}
      </Label>
      <rect
        y={50}
        width={286}
        height={60}
        rx={8}
        className="kx-tone"
        style={{ fill: active ? "var(--color-fd-card)" : "var(--color-fd-muted)", stroke: active ? "var(--color-fd-primary)" : "var(--color-fd-border)" }}
        strokeWidth={1.5}
      />
    </g>
  )
}

// ── 2. One commit wave: several appends, one fsync, then acknowledgements ───

export function GroupCommitAnimation() {
  // phases: 0 empty · 1 A writes · 2 B writes · 3 sync wave 1, C waits · 4 wave 1 durable · 5 sync wave 2 · 6 wave 2 durable
  return (
    <Animation label="Appends that arrive together share one commit wave and one fsync; each is acknowledged when the wave is durable." phases={7} ms={1300} viewBox="0 0 640 230">
      {(phase) => {
        const syncing1 = phase >= 3
        const durable1 = phase >= 4
        const syncing2 = phase >= 5
        const durable2 = phase >= 6
        return (
          <>
            <Label x={30} y={26} size={13} weight={600}>
              Appends
            </Label>
            <Label x={250} y={26} size={13} weight={600}>
              Commit waves
            </Label>
            <Label x={500} y={26} size={13} weight={600}>
              Watermark
            </Label>

            <WaveBox y={56} name="wave 1" syncing={syncing1} durable={durable1} />
            <WaveBox y={142} name="wave 2" syncing={syncing2} durable={durable2} />

            <AppendChip name="A" phase={phase} arrive={1} x={phase >= 1 ? 252 : 30} y={phase >= 1 ? 66 : 50} done={durable1} />
            <AppendChip name="B" phase={phase} arrive={2} x={phase >= 2 ? 342 : 30} y={phase >= 2 ? 66 : 100} done={durable1} />
            <AppendChip name="C" phase={phase} arrive={3} x={phase >= 3 ? 252 : 30} y={phase >= 3 ? 152 : 150} done={durable2} />

            <At x={500} y={86}>
              <Label size={36} weight={700} mono>
                {durable2 ? "7" : durable1 ? "6" : "4"}
              </Label>
              <Label y={26} size={11.5} muted>
                {durable2 ? "C acknowledged" : durable1 ? "A and B acknowledged" : "waiting for fsync"}
              </Label>
            </At>
          </>
        )
      }}
    </Animation>
  )
}

function WaveBox({ y, name, syncing, durable }: { y: number; name: string; syncing: boolean; durable: boolean }) {
  return (
    <At x={240} y={y}>
      <Box w={200} h={70} tone={durable ? "ok" : "plain"} />
      <Label x={10} y={-6} size={11} muted>
        {name}
      </Label>
      <rect x={10} y={56} width={180} height={6} rx={3} style={{ fill: "var(--color-fd-muted)" }} />
      <rect
        x={10}
        y={56}
        height={6}
        rx={3}
        className={syncing ? "kx-grow" : undefined}
        style={{ width: syncing ? 180 : 0, fill: durable ? "var(--color-fd-success)" : "var(--color-fd-primary)" }}
      />
      <Label x={196} y={-6} size={11} muted anchor="end">
        {durable ? "durable" : syncing ? "fdatasync" : ""}
      </Label>
    </At>
  )
}

function AppendChip({ name, x, y, done, phase, arrive }: { name: string; x: number; y: number; done: boolean; phase: number; arrive: number }) {
  return (
    <At x={x} y={y}>
      <rect width={78} height={34} rx={17} className="kx-tone" style={{ fill: done ? "color-mix(in oklab, var(--color-fd-success) 30%, var(--color-fd-card))" : accent(phase >= arrive ? 30 : 14), stroke: done ? "var(--color-fd-success)" : "var(--color-fd-primary)" }} />
      <Label x={39} y={22} size={13} anchor="middle" weight={600}>
        {done ? `${name} ✓` : name}
      </Label>
    </At>
  )
}

// ── 3. Indexing one event: its position goes under its type and each tag ───

const indexRows: Array<{ key: string; before: string; after: string; hit: boolean }> = [
  { key: "type ToolAdded", before: "0 2", after: "0 2", hit: false },
  { key: "type ToolRented", before: "3", after: "3 4", hit: true },
  { key: "toolId=t-1", before: "0", after: "0 4", hit: true },
  { key: "toolId=t-2", before: "2 3", after: "2 3", hit: false },
  { key: "customerId=ada", before: "1 3", after: "1 3 4", hit: true },
]

export function IndexingAnimation() {
  // phases: 0 event appears · 1 position copies travel · 2 sets updated
  return (
    <Animation label="An event's position is added to the position set of its type and of each of its tags." phases={3} ms={1500} viewBox="0 0 640 200">
      {(phase) => {
        const hits = indexRows.map((row, index) => ({ ...row, index })).filter((row) => row.hit)
        return (
          <>
            <At x={24} y={60}>
              <Box w={200} h={88} tone="accent" />
              <Label x={14} y={24} size={13} weight={600}>
                position 4
              </Label>
              <Label x={14} y={46} size={12} mono>
                ToolRented
              </Label>
              <Label x={14} y={64} size={12} mono muted>
                toolId=t-1
              </Label>
              <Label x={14} y={80} size={12} mono muted>
                customerId=ada
              </Label>
            </At>

            <At x={300} y={14}>
              <Box w={316} h={176} />
              {indexRows.map((row, index) => {
                const lit = row.hit && phase >= 2
                return (
                  <g key={row.key}>
                    <Label x={16} y={36 + index * 30} size={12.5} mono muted={!row.hit}>
                      {row.key}
                    </Label>
                    <Label x={300} y={36 + index * 30} size={12.5} mono anchor="end" weight={lit ? 700 : undefined}>
                      {`{${phase >= 2 ? row.after : row.before}}`}
                    </Label>
                  </g>
                )
              })}
            </At>

            {hits.map((row) => (
              <At key={row.key} x={phase >= 1 ? 506 : 170} y={phase >= 1 ? 35 + row.index * 30 : 72} show={phase === 1}>
                <rect width={26} height={20} rx={10} style={{ fill: "var(--color-fd-primary)" }} />
                <text x={13} y={14.5} textAnchor="middle" style={{ fill: "var(--color-fd-primary-foreground)", fontSize: 12, fontWeight: 700 }}>
                  4
                </text>
              </At>
            ))}
          </>
        )
      }}
    </Animation>
  )
}

// ── 4. Merging: eight key tables become one ────────────────────────────────

export function MergeAnimation() {
  // phases: 0 eight tables · 1 they move together · 2 one table
  const segW = 64
  const gap = 10
  const x = (index: number) => 24 + index * (segW + gap)
  const mergedW = x(7) + segW - x(0)
  return (
    <Animation label="The key tables of eight committed segments are merged into one table." phases={3} ms={1500} viewBox="0 0 640 170">
      {(phase) => (
        <>
          {Array.from({ length: 8 }, (_, index) => (
            <g key={index} style={{ transform: `translate(${x(index)}px, 30px)` }}>
              <Box w={segW} h={40} label={`S${index}`} />
            </g>
          ))}
          {Array.from({ length: 8 }, (_, index) => (
            <At key={index} x={phase === 1 ? x(0) + (mergedW - segW) / 2 : x(index)} y={phase === 1 ? 112 : 84} show={phase < 2}>
              <Box w={segW} h={30} label=".keys" tone="accent" mono />
            </At>
          ))}
          <At x={x(0)} y={112} show={phase === 2}>
            <Box w={mergedW} h={30} label="one key table for S0 to S7" tone="accent" />
          </At>
        </>
      )}
    </Animation>
  )
}

// ── 5. A query: intersect position sets, then read the records ─────────────

const tagSet = [0, 4, 9, 30, 33]
const typeSet = [3, 4, 11, 30, 40]

export function QueryAnimation() {
  // phases: 0 two sets · 1 common positions marked · 2 result · 3 records read
  return (
    <Animation label="A query intersects the position sets of its tag and its type, then reads the records at the resulting positions." phases={4} ms={1500} viewBox="0 0 640 220">
      {(phase) => (
        <>
          <PositionRow y={20} name="toolId=t-1" values={tagSet} phase={phase} />
          <PositionRow y={70} name="type ToolRented" values={typeSet} phase={phase} />
          <At x={24} y={142} show={phase >= 2}>
            <Label size={13} weight={600}>
              Result
            </Label>
          </At>
          {[4, 30].map((position, index) => (
            <At key={position} x={phase >= 2 ? 180 + index * 70 : 180 + tagSet.indexOf(position) * 70} y={phase >= 2 ? 124 : 24} show={phase >= 1}>
              <rect width={52} height={30} rx={15} style={{ fill: "var(--color-fd-primary)" }} />
              <text x={26} y={20} textAnchor="middle" style={{ fill: "var(--color-fd-primary-foreground)", fontSize: 13, fontWeight: 700 }}>
                {position}
              </text>
            </At>
          ))}
          <Arrow x1={330} y1={139} x2={376} y2={139} show={phase >= 3} tone="accent" />
          <At x={384} y={120} show={phase >= 3}>
            <Box w={232} h={40} label="read 2 records, check CRCs" />
          </At>
        </>
      )}
    </Animation>
  )
}

function PositionRow({ y, name, values, phase }: { y: number; name: string; values: number[]; phase: number }) {
  return (
    <g style={{ transform: `translate(0px, ${y}px)` }}>
      <Label x={24} y={20} size={12.5} mono>
        {name}
      </Label>
      {values.map((value, index) => {
        const common = tagSet.includes(value) && typeSet.includes(value)
        return (
          <g key={value} style={{ transform: `translate(${180 + index * 70}px, 0px)` }}>
            <rect
              width={52}
              height={30}
              rx={15}
              className="kx-tone"
              style={{ fill: phase >= 1 && common ? accent(40) : "var(--color-fd-muted)", stroke: phase >= 1 && common ? "var(--color-fd-primary)" : "var(--color-fd-border)" }}
            />
            <Label x={26} y={20} size={13} anchor="middle" mono>
              {value}
            </Label>
          </g>
        )
      })}
    </g>
  )
}
