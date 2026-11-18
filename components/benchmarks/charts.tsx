"use client"

import { useState } from "react"
import {
  appendRows,
  clusterOneZoneRows,
  clusterThreeZoneRows,
  conditionalRows,
  type Row,
  tagReadRows,
  wholeLogRows,
} from "./data"

type Series = { key: string; name: string; color: string }

const kronosdb: Series = { key: "kronosdb", name: "KronosDB", color: "var(--kb-kronosdb)" }
const postgres: Series = { key: "postgres", name: "Postgres 16", color: "var(--kb-postgres)" }
const durable: Series = { key: "durable", name: "durable", color: "var(--kb-kronosdb)" }
const written: Series = { key: "written", name: "written", color: "var(--kb-written)" }

const number = new Intl.NumberFormat("en-US")
const ms = (value: number) => (value < 1 ? `${value.toFixed(3)} ms` : `${value.toFixed(1)} ms`)

/**
 * Horizontal bars, two per row. Each row has its own scale, because the rows
 * differ by up to a thousand times; the bars compare the two series within a
 * row, and the number at the end of each bar is the measurement.
 */
function BarChart({
  title,
  unit,
  rows,
  series,
  compare,
}: {
  title: string
  unit: string
  rows: Row[]
  series: [Series, Series]
  /** What the badge at the end of a row shows. */
  compare: "ratio" | "difference"
}) {
  const [active, setActive] = useState<string | null>(null)
  const [table, setTable] = useState(false)

  return (
    <figure className="kb-chart not-prose my-6 rounded-xl border bg-fd-card p-4">
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm font-medium text-fd-foreground">{title}</span>
        <span className="flex items-center gap-4 text-xs text-fd-muted-foreground">
          {series.map((item) => (
            <span key={item.key} className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-sm" style={{ background: item.color }} />
              {item.name}
            </span>
          ))}
          <button type="button" className="underline-offset-2 hover:underline" onClick={() => setTable((value) => !value)}>
            {table ? "Show chart" : "Show table"}
          </button>
        </span>
      </figcaption>

      {table ? (
        <table className="w-full text-left text-xs">
          <thead className="text-fd-muted-foreground">
            <tr>
              <th className="py-1 font-medium" />
              {series.map((item) => (
                <th key={item.key} className="py-1 font-medium">
                  {item.name}: {unit}, p50, p99
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows.map((row) => (
              <tr key={row.label} className="border-t">
                <td className="py-1.5 font-sans">{row.label}</td>
                {series.map((item) => {
                  const measurement = row.values[item.key]!
                  return (
                    <td key={item.key} className="py-1.5">
                      {number.format(measurement.value)}
                      {measurement.p50 !== undefined && ` · ${ms(measurement.p50)}`}
                      {measurement.p99 !== undefined && ` · ${ms(measurement.p99)}`}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => {
            const [first, second] = series.map((item) => row.values[item.key]!)
            const max = Math.max(first!.value, second!.value)
            const badge =
              compare === "ratio"
                ? `${(first!.value / second!.value).toFixed(1)}×`
                : `${(((second!.value - first!.value) / first!.value) * 100).toFixed(0)}%`
            return (
              <div key={row.label} className="grid grid-cols-[7.5rem_1fr_3.25rem] items-center gap-x-3 max-sm:grid-cols-[1fr_3.25rem]">
                <div className="text-xs text-fd-muted-foreground max-sm:col-span-2">{row.label}</div>
                <div className="flex flex-col gap-0.5">
                  {series.map((item) => {
                    const measurement = row.values[item.key]!
                    const id = `${row.label}-${item.key}`
                    return (
                      <div key={item.key} className="relative flex h-4 items-center gap-2">
                        <button
                          type="button"
                          className="h-3.5 rounded-r-[4px] outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
                          style={{
                            width: `${Math.max((measurement.value / max) * 78, 0.6)}%`,
                            background: item.color,
                            opacity: active && active !== id ? 0.55 : 1,
                          }}
                          aria-label={`${row.label}, ${item.name}: ${number.format(measurement.value)} ${unit}`}
                          onMouseEnter={() => setActive(id)}
                          onMouseLeave={() => setActive(null)}
                          onFocus={() => setActive(id)}
                          onBlur={() => setActive(null)}
                        />
                        <span className="font-mono text-xs tabular-nums text-fd-foreground">{number.format(measurement.value)}</span>
                        {active === id && (measurement.p50 !== undefined || measurement.p99 !== undefined) && (
                          <span
                            role="tooltip"
                            className="absolute bottom-5 left-0 z-10 whitespace-nowrap rounded-md border bg-fd-popover px-2 py-1 text-xs text-fd-popover-foreground shadow-md"
                          >
                            {item.name}: {number.format(measurement.value)} {unit}
                            {measurement.p50 !== undefined && ` · p50 ${ms(measurement.p50)}`}
                            {measurement.p99 !== undefined && ` · p99 ${ms(measurement.p99)}`}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="text-right font-mono text-sm font-semibold tabular-nums text-fd-foreground">{badge}</div>
              </div>
            )
          })}
        </div>
      )}
    </figure>
  )
}

export function AppendChart() {
  return <BarChart title="Appends, events per second" unit="events/s" rows={appendRows} series={[kronosdb, postgres]} compare="ratio" />
}

export function ConditionalAppendChart() {
  return <BarChart title="Conditional appends, events per second" unit="events/s" rows={conditionalRows} series={[kronosdb, postgres]} compare="ratio" />
}

export function TagReadChart() {
  return <BarChart title="Reads by tag, 10 events each, events per second" unit="events/s" rows={tagReadRows} series={[kronosdb, postgres]} compare="ratio" />
}

export function WholeLogReadChart() {
  return <BarChart title="Reads of the whole log, 100 000 events each, events per second" unit="events/s" rows={wholeLogRows} series={[kronosdb, postgres]} compare="ratio" />
}

export function ClusterOneZoneChart() {
  return <BarChart title="Three voters in one zone, appends per second" unit="appends/s" rows={clusterOneZoneRows} series={[written, durable]} compare="difference" />
}

export function ClusterThreeZoneChart() {
  return <BarChart title="One voter in each of three zones, appends per second" unit="appends/s" rows={clusterThreeZoneRows} series={[written, durable]} compare="difference" />
}
