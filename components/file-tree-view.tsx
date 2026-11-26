"use client"

import { type CSSProperties, Fragment, useState } from "react"
import { ChevronRight, FileText, Folder, FolderOpen } from "lucide-react"

export type TreeRow = {
  kind: "file" | "folder"
  depth: number
  name: string
  note?: string
  /** Index of the folder row this row sits in, or -1 at the top. */
  parent: number
  collapsed: boolean
}

function Note({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/).map((part, index) =>
        part.startsWith("`") && part.endsWith("`") ? (
          <code key={index} className="rounded bg-fd-muted px-1 py-px font-mono text-[0.8em] text-fd-foreground">
            {part.slice(1, -1)}
          </code>
        ) : (
          part
        ),
      )}
    </>
  )
}

export function FileTreeView({ rows, title }: { rows: TreeRow[]; title?: string }) {
  const [open, setOpen] = useState(() => new Set(rows.flatMap((row, index) => (row.kind === "folder" && !row.collapsed ? [index] : []))))

  const visible = (index: number): boolean => {
    const parent = rows[index]!.parent
    return parent === -1 || (open.has(parent) && visible(parent))
  }
  const toggle = (index: number) =>
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })

  return (
    <div className="not-prose my-6 overflow-hidden rounded-xl border bg-fd-card text-sm text-fd-card-foreground">
      {title ? <div className="border-b px-4 py-2 font-mono text-xs text-fd-muted-foreground">{title}</div> : null}
      <div className="grid grid-cols-1 gap-x-8 px-3 py-2 md:grid-cols-[max-content_1fr]">
        {rows.map((row, index) => {
          if (!visible(index)) return null
          const isOpen = open.has(index)
          const label = (
            <>
              {row.kind === "folder" ? (
                <>
                  <ChevronRight
                    aria-hidden
                    className={`size-3.5 shrink-0 text-fd-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`}
                  />
                  {isOpen ? (
                    <FolderOpen aria-hidden className="size-4 shrink-0 text-fd-primary" />
                  ) : (
                    <Folder aria-hidden className="size-4 shrink-0 text-fd-primary" />
                  )}
                </>
              ) : (
                <FileText aria-hidden className="ms-[1.375rem] size-4 shrink-0 text-fd-muted-foreground" />
              )}
              <span className={`break-all font-mono ${row.kind === "folder" ? "font-medium" : ""}`}>
                {row.name}
                {row.kind === "folder" ? <span className="text-fd-muted-foreground">/</span> : null}
              </span>
            </>
          )
          return (
            <Fragment key={index}>
              <div className="flex min-w-0 items-stretch">
                {Array.from({ length: row.depth }, (_, level) => (
                  <span key={level} aria-hidden className="ms-[13px] w-3 shrink-0 border-s border-fd-border" />
                ))}
                {row.kind === "folder" ? (
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => toggle(index)}
                    className="-mx-1 flex min-w-0 items-center gap-1.5 rounded-md px-1 py-1.5 text-start hover:bg-fd-accent"
                  >
                    {label}
                  </button>
                ) : (
                  <span className="flex min-w-0 items-center gap-1.5 py-1.5">{label}</span>
                )}
              </div>
              <div
                className="min-w-0 pb-1.5 ps-[calc(var(--depth)*1.5625rem+2.75rem)] leading-relaxed text-fd-muted-foreground empty:hidden md:py-1.5 md:ps-0 md:empty:block"
                style={{ "--depth": row.depth } as CSSProperties}
              >
                {row.note ? <Note text={row.note} /> : null}
              </div>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
