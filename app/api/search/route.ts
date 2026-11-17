import { createFromSource } from "fumadocs-core/search/server"
import { source } from "@/lib/source"

// Built once at export time; the search dialog downloads the index and searches in the browser.
export const revalidate = false
export const { staticGET: GET } = createFromSource(source)
