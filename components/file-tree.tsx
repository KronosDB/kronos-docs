import { Children, isValidElement, type ReactNode } from "react"
import { FileTreeView, type TreeRow } from "./file-tree-view"

type EntryProps = {
  /** The file or folder name, as it appears on disk. */
  name: string
  /** What it holds. `backticks` render as code. */
  note?: string
  /** A folder that starts closed; the reader opens it with a click. */
  collapsed?: boolean
  children?: ReactNode
}

/** A file in a {@link FileTree}. */
export function TreeFile(_props: EntryProps): null {
  return null
}

/** A folder in a {@link FileTree}; its children are the entries inside it. */
export function TreeFolder(_props: EntryProps): null {
  return null
}

function rowsOf(children: ReactNode, depth: number, parent: number, rows: TreeRow[]): TreeRow[] {
  Children.forEach(children, (child) => {
    if (!isValidElement<EntryProps>(child)) return
    const { name, note, collapsed, children: inner } = child.props
    if (typeof name !== "string") return
    const kind = child.type === TreeFolder || inner !== undefined ? "folder" : "file"
    const index = rows.length
    rows.push({ kind, depth, name, note, parent, collapsed: collapsed === true })
    if (inner !== undefined) rowsOf(inner, depth + 1, index, rows)
  })
  return rows
}

/**
 * A directory layout. Folders are open unless marked `collapsed`, and the reader opens and closes them with a click.
 *
 *   <FileTree>
 *     <TreeFolder name="slices">
 *       <TreeFile name="index.ts" note="every context, one line each" />
 *       <TreeFolder name="add-tool" collapsed>
 *         <TreeFile name="command.ts" note="`AddTool`" />
 *       </TreeFolder>
 *     </TreeFolder>
 *   </FileTree>
 */
export function FileTree({ children, title }: { children: ReactNode; title?: string }) {
  return <FileTreeView rows={rowsOf(children, 0, -1, [])} title={title} />
}
