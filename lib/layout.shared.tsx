import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"
import { ProductSwitcher } from "@/components/product-switcher"

/** Nav options shared by the docs layouts. */
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <ProductSwitcher />,
      url: "/docs/kronos-ts",
    },
    githubUrl: "https://github.com/KronosDB",
  }
}
