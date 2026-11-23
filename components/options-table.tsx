import type { ReactNode } from "react"

export type Option = {
  type: ReactNode
  description?: ReactNode
  default?: ReactNode
  required?: boolean
  deprecated?: boolean
}

/**
 * An options object, every field open: name and type on the left, what it does and its default on the right.
 * Registered as `TypeTable`, so pages keep the fumadocs prop shape (`type={{ name: { type, description, default } }}`).
 */
export function OptionsTable({ type, id }: { type: Record<string, Option>; id?: string }) {
  return (
    <div id={id} className="not-prose my-6 overflow-hidden rounded-xl border bg-fd-card text-sm text-fd-card-foreground">
      <div className="hidden grid-cols-[minmax(11rem,15rem)_1fr] gap-x-6 border-b px-4 py-2 text-xs font-medium text-fd-muted-foreground md:grid">
        <span>Option</span>
        <span>Description</span>
      </div>
      {Object.entries(type).map(([name, option]) => (
        <div
          key={name}
          id={id ? `${id}-${name}` : undefined}
          className="grid scroll-m-20 gap-x-6 gap-y-1.5 border-b px-4 py-3 last:border-b-0 md:grid-cols-[minmax(11rem,15rem)_1fr]"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <code className={`break-all font-mono font-medium text-fd-primary ${option.deprecated ? "line-through opacity-60" : ""}`}>
                {name}
              </code>
              {option.required ? <span className="text-xs text-fd-muted-foreground">required</span> : null}
            </div>
            <div className="mt-0.5 break-words font-mono text-xs leading-relaxed text-fd-muted-foreground">{option.type}</div>
          </div>
          <div className="min-w-0 leading-relaxed">
            {option.description}
            {option.default !== undefined ? (
              <div className="mt-1 text-xs text-fd-muted-foreground">
                Default: <code className="font-mono text-fd-foreground">{option.default}</code>
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
