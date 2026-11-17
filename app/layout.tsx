import "./global.css"
import { RootProvider } from "fumadocs-ui/provider/next"
import type { ReactNode } from "react"

export const metadata = {
  title: { template: "%s — Kronos", default: "Kronos" },
  description: "Kronos — DCB event sourcing in TypeScript, as functions you compose — and KronosDB, the event store built for it.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider search={{ options: { type: "static" } }}>{children}</RootProvider>
      </body>
    </html>
  )
}
