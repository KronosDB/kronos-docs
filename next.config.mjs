import { createMDX } from "fumadocs-mdx/next"

const withMDX = createMDX()

// A static export: `next build` writes the whole site to `out/`, which
// Cloudflare serves as plain files. Redirects live in `public/_redirects`.
export default withMDX({
  reactStrictMode: true,
  output: "export",
})
