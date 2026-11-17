"use client"

import { useId } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronsUpDown, Check } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "fumadocs-ui/components/ui/popover"

const products = [
  { id: "kronos-ts", href: "/docs/kronos-ts", prefix: "Kronos", suffix: "", description: "The framework" },
  { id: "kronosdb", href: "/docs/kronosdb", prefix: "Kronos", suffix: "DB", description: "The event store" },
] as const

const GOLD = "#c8a44e"
const GOLD_HI = "#e2c77a"
const GOLD_LO = "#9a7b2e"
const GOLD_DK = "#6e5620"
// The two chambers, drawn on a 64-unit canvas, with a short neck channel
// between them (x 30.2–33.8) so a grain can sit in it.
const LEFT_BULB = "M13 16C23.5 16 27.4 25.5 30.2 30.4L30.2 33.6C27.4 38.5 23.5 48 13 48Z"
const RIGHT_BULB = "M51 16C40.5 16 36.6 25.5 33.8 30.4L33.8 33.6C36.6 38.5 40.5 48 51 48Z"

/**
 * The Kronos mark: an hourglass lying on its side. Two end plates, the glass
 * between them, and the sand settled along the bottom of both chambers where
 * gravity left it — mounding toward the neck, a grain or two still in it.
 */
export function KronosMark({ className, size = 26 }: { className?: string; size?: number }) {
  const id = useId()
  const glass = `${id}g`, sand = `${id}s`, plate = `${id}p`, sheen = `${id}sh`, clipL = `${id}l`, clipR = `${id}r`
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className={className}>
      <defs>
        <linearGradient id={glass} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={GOLD_HI} />
          <stop offset=".5" stopColor={GOLD} />
          <stop offset="1" stopColor={GOLD_LO} />
        </linearGradient>
        <linearGradient id={sand} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={GOLD} />
          <stop offset="1" stopColor={GOLD_LO} />
        </linearGradient>
        <linearGradient id={plate} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={GOLD_HI} />
          <stop offset=".45" stopColor={GOLD} />
          <stop offset="1" stopColor={GOLD_LO} />
        </linearGradient>
        <linearGradient id={sheen} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={GOLD_HI} stopOpacity=".22" />
          <stop offset=".45" stopColor={GOLD} stopOpacity=".04" />
          <stop offset="1" stopColor={GOLD_LO} stopOpacity=".14" />
        </linearGradient>
        <clipPath id={clipL}><path d={LEFT_BULB} /></clipPath>
        <clipPath id={clipR}><path d={RIGHT_BULB} /></clipPath>
      </defs>
      {/* end plates, with a shadowed inner edge for thickness */}
      <rect x="6.2" y="10" width="4.6" height="44" rx="1.8" fill={`url(#${plate})`} />
      <rect x="53.2" y="10" width="4.6" height="44" rx="1.8" fill={`url(#${plate})`} />
      <path d="M10.8 12.5V51.5M53.2 12.5V51.5" stroke={GOLD_DK} strokeWidth="1" opacity=".5" />
      {/* the glass body: a diagonal sheen */}
      <path d={LEFT_BULB} fill={`url(#${sheen})`} />
      <path d={RIGHT_BULB} fill={`url(#${sheen})`} />
      {/* sand, settled and mounding toward the neck, with a lit surface */}
      <path d="M0 40H24C27.5 40 29 36.8 30.5 36.6V60H0Z" fill={`url(#${sand})`} clipPath={`url(#${clipL})`} />
      <path d="M64 40H40C36.5 40 35 36.8 33.5 36.6V60H64Z" fill={`url(#${sand})`} clipPath={`url(#${clipR})`} />
      <path d="M14 40H24C27.5 40 29 36.8 30.5 36.6" fill="none" stroke={GOLD_HI} strokeWidth=".9" opacity=".8" clipPath={`url(#${clipL})`} />
      <path d="M50 40H40C36.5 40 35 36.8 33.5 36.6" fill="none" stroke={GOLD_HI} strokeWidth=".9" opacity=".8" clipPath={`url(#${clipR})`} />
      {/* the glass outline */}
      <path d={LEFT_BULB} fill="none" stroke={`url(#${glass})`} strokeWidth="2.6" strokeLinejoin="round" />
      <path d={RIGHT_BULB} fill="none" stroke={`url(#${glass})`} strokeWidth="2.6" strokeLinejoin="round" />
      {/* a lens of reflected light on each chamber */}
      <path d="M16.6 19.6C19.8 20.4 22.6 23.2 24.4 26.6 22 24.6 19.2 22.4 16.6 19.6Z" fill={GOLD_HI} opacity=".95" />
      <path d="M47.4 19.6C44.2 20.4 41.4 23.2 39.6 26.6 42 24.6 44.8 22.4 47.4 19.6Z" fill={GOLD_HI} opacity=".95" />
      {/* two grains still in the neck */}
      <circle cx="31.2" cy="32.8" r=".8" fill={GOLD_HI} />
      <circle cx="32.9" cy="32.6" r=".7" fill={GOLD_HI} opacity=".85" />
    </svg>
  )
}

/**
 * The one place to see which docs you are in, and to switch. Lives in the
 * navbar's title slot, so it is the top-left of every page.
 */
export function ProductSwitcher() {
  const pathname = usePathname()
  const current = products.find((p) => pathname.startsWith(p.href)) ?? products[0]

  return (
    <Popover>
      <PopoverTrigger
        className="-ml-2 flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-fd-accent data-[state=open]:bg-fd-accent"
        aria-label="Switch documentation set"
      >
        <KronosMark className="shrink-0" />
        <span className="font-semibold tracking-tight text-fd-foreground">
          {current.prefix}
          <span className="text-fd-primary">{current.suffix}</span>
          <span className="ml-2 hidden text-xs font-normal text-fd-muted-foreground sm:inline">docs</span>
        </span>
        <ChevronsUpDown className="size-3.5 text-fd-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        {products.map((p) => {
          const active = p.id === current.id
          return (
            <Link
              key={p.id}
              href={p.href}
              className="flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-fd-accent"
              aria-current={active ? "page" : undefined}
            >
              <KronosMark className="shrink-0" />
              <span className="flex flex-1 flex-col">
                <span className="font-medium text-fd-foreground">
                  {p.prefix}
                  <span className="text-fd-primary">{p.suffix}</span>
                </span>
                <span className="text-xs text-fd-muted-foreground">{p.description}</span>
              </span>
              {active ? <Check className="size-4 text-fd-primary" /> : null}
            </Link>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
