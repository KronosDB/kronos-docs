"use client"

import { Fragment } from "react"
import { type ExplainerStep, Explainer } from "./player"
import { Arrow, At, Box, Label, Reveal } from "./stage"

/**
 * How KronosDB stores and indexes events, as of KronosDB 0.16.
 *
 * The storyboard, with a source reference for every value, is in
 * .agents/storyboard-storage-indexing.md. Segments are scaled down to 640
 * bytes so that one fits on screen; every byte offset and size shown is
 * computed from the real record layout for these events.
 */

const steps: ExplainerStep[] = [
  {
    title: "The append and its condition",
    caption:
      "A client appends a ToolRented event for tool t-1, on the condition that no ToolRented event for t-1 exists at or after position 3, the position it last read up to. The server answers that question from its key indexes without reading any event bytes. Nothing matches, so the append continues.",
  },
  {
    title: "A record in the active segment",
    caption:
      "The event is written to the end of the active segment file as one record: a 9-byte header with a CRC32C checksum, the length and a flags byte, then the event itself, tags included. The server assigns position 4. One write call puts the bytes in the operating system's page cache, which does not make them durable yet.",
  },
  {
    title: "Group commit",
    caption:
      "Appends that arrive close together share one commit wave, and one fdatasync makes a whole wave durable. When the sync returns, the commit watermark moves past the wave and each client receives its acknowledgement. Appends that arrive during a sync join the next wave.",
    duration: 9000,
  },
  {
    title: "The active segment's index",
    caption:
      "The active segment has an index in memory. Each event adds its position under one key for its type and one key per tag, and its byte offset to a list. This index is not written to disk while the segment is active; after a restart the server rebuilds it by reading the segment.",
  },
  {
    title: "Sealing a full segment",
    caption:
      "When the next record does not fit, the server starts a new segment file and seals the old one. The sealed file is trimmed to its data and never written again. Its in-memory index stays available to readers until its index files exist.",
  },
  {
    title: "Index files for a sealed segment",
    caption:
      "After the next commit, a background thread writes two files beside the sealed segment: a key table (.keys) with every key and the positions that hold it, and a locator (.idx) with the byte offset of every event. Both are written under a temporary name, synced and renamed, and both can be rebuilt from the segment if one is lost.",
    duration: 8500,
  },
  {
    title: "Merging key tables",
    caption:
      "In the background, the key tables of 8 consecutive committed segments are merged into one table, so a query reads one table where it would read eight. The merged table becomes active when a manifest file naming it is written; the old key tables are deleted after that. Segment files and locators do not change.",
    duration: 8500,
  },
  {
    title: "A query, range by range",
    caption:
      "A query for ToolRented events tagged toolId=t-1 is answered per range of positions: the merged table covers 0 to 55, segment S8's key table 56 to 62, and the active index 63 up to the watermark. Each range intersects the position sets of the tag and the type. The results are positions 4, 30, 58 and 64.",
    duration: 8500,
  },
  {
    title: "From positions to bytes",
    caption:
      "Each position is mapped to its segment, then to a byte offset by that segment's locator. The record is read from the memory-mapped segment file and its CRC32C is checked before it is used. A checksum mismatch fails the read instead of returning the record.",
  },
  {
    title: "Streaming the result",
    caption:
      "The server copies the stored records into Events messages of up to 1024 events or 1 MiB. The last message carries the head position at the time of the request as the consistency marker. The client passes that marker in the condition of its next append.",
  },
  {
    title: "Segments in an archive",
    caption:
      "With an archive configured, committed segments are copied to object storage, and a node over its disk limit can delete its local copy of an archived segment. The key tables and locators stay on disk, so a query is planned as before. Only the record bytes are read from the archive, by byte range.",
  },
]

// ── demo data: segment S0, scaled to 640 bytes (see the storyboard) ───────────

type Rec = { position: number; start: number; size: number; tags: string }

const records: Rec[] = [
  { position: 0, start: 13, size: 81, tags: "t-1" },
  { position: 1, start: 94, size: 92, tags: "ada" },
  { position: 2, start: 186, size: 79, tags: "t-2" },
  { position: 3, start: 265, size: 93, tags: "t-2 · ada" },
  { position: 4, start: 358, size: 93, tags: "t-1 · ada" },
  { position: 5, start: 451, size: 92, tags: "bob" },
  { position: 6, start: 543, size: 79, tags: "t-3" },
]

const BAR_X = 80
const BAR_Y = 370
const BAR_H = 40

const indexBefore: Array<[string, string]> = [
  ["type ToolAdded", "0 2"],
  ["type CustomerRegistered", "1"],
  ["type ToolRented", "3"],
  ["toolId=t-1", "0"],
  ["toolId=t-2", "2 3"],
  ["customerId=ada", "1 3"],
]

const indexAfter: Array<[string, string, boolean]> = [
  ["type ToolAdded", "0 2 6", false],
  ["type CustomerRegistered", "1 5", false],
  ["type ToolRented", "3 4", true],
  ["toolId=t-1", "0 4", true],
  ["toolId=t-2", "2 3", false],
  ["toolId=t-3", "6", false],
  ["customerId=ada", "1 3 4", true],
  ["customerId=bob", "5", false],
]

const accent = (percent: number) => `color-mix(in oklab, var(--color-fd-primary) ${percent}%, var(--color-fd-card))`

export function StorageAndIndexing() {
  return (
    <Explainer title="How KronosDB stores and indexes events" steps={steps} viewBox="0 0 800 460">
      {(step) => <Stage step={step} />}
    </Explainer>
  )
}

function Stage({ step }: { step: number }) {
  const on = (...shown: number[]) => shown.includes(step)
  const written = (position: number) => position <= 3 || (position === 4 && step >= 1) || (position >= 5 && step >= 2)
  const sealed = step >= 4

  return (
    <>
      <At x={20} y={22}>
        <Label size={11} muted mono>
          {step <= 5 ? "context toolstore · segment S0, scaled down to 640 bytes" : "context toolstore · the whole log, 7 events per segment"}
        </Label>
      </At>

      {/* client and request */}
      <At x={20} y={40} show={on(0, 1)}>
        <Box w={220} h={132} label="Client" align="top" />
        <Label x={14} y={52} size={11} mono>
          append ToolRented
        </Label>
        <Label x={14} y={68} size={11} mono muted>
          toolId=t-1 customerId=ada
        </Label>
        <Label x={14} y={92} size={11} mono>
          condition
        </Label>
        <Label x={14} y={108} size={11} mono muted>
          no ToolRented, toolId=t-1
        </Label>
        <Label x={14} y={122} size={11} mono muted>
          at or after position 3
        </Label>
      </At>

      {/* checklist */}
      <At x={262} y={40} show={on(0)}>
        <Box w={250} h={190} label="Server checks" align="top" />
        <g key={on(0) ? "live" : "idle"}>
        {[
          ["Names do not start with $", "ok"],
          ["Store is writable", "ok"],
          ["Sealed segments ≥ 3: none", "ok"],
          ["Active index: t-1 at ≥ 3?", "none"],
        ].map(([text, result], index) => (
          <Reveal key={text} at={600 + index * 900}>
            <circle cx={20} cy={50 + index * 30} r={5} style={{ fill: "var(--color-fd-success)" }} />
            <Label x={32} y={54 + index * 30} size={11.5}>
              {text}
            </Label>
            <Label x={238} y={54 + index * 30} size={11} anchor="end" muted mono>
              {result}
            </Label>
          </Reveal>
        ))}
        <Reveal at={4400}>
          <At x={14} y={160}>
            <Box w={222} h={22} tone="ok" label="no conflict: write" />
          </At>
        </Reveal>
        </g>
      </At>

      {/* in-memory index before p4 */}
      <At x={534} y={40} show={on(0)}>
        <Box w={246} h={190} label="Active index (memory)" align="top" />
        {indexBefore.map(([key, positions], index) => {
          const hot = key === "toolId=t-1" || key === "type ToolRented"
          return (
            <Fragment key={key}>
              <Label x={14} y={56 + index * 22} size={11} mono muted={!hot}>
                {key}
              </Label>
              <Label x={232} y={56 + index * 22} size={11} mono anchor="end" weight={hot ? 600 : undefined}>
                {`{${positions}}`}
              </Label>
            </Fragment>
          )
        })}
      </At>
      <Arrow x1={512} y1={150} x2={532} y2={150} show={on(0)} tone="accent" />

      {/* record anatomy */}
      <At x={254} y={60} show={on(1)}>
        <Label size={12} weight={600}>
          One record, 93 bytes
        </Label>
        <At y={14}>
          <RecordAnatomy />
        </At>
        <Label y={124} size={11} muted>
          Tags are stored in the record. Every index is built from the records and can be rebuilt.
        </Label>
      </At>

      {/* group commit timeline */}
      <At x={20} y={56} show={on(2)}>
        <CommitTimeline key={on(2) ? "live" : "idle"} />
      </At>

      {/* index with offsets */}
      <At x={sealed ? 440 : 80} y={40} show={on(3, 4)}>
        <Box
          w={300}
          h={230}
          label={sealed ? "S0 index, in memory until its files exist" : "Active index (memory)"}
          align="top"
          tone={sealed ? "muted" : "plain"}
        />
        {indexAfter.map(([key, positions, hot], index) => (
          <Fragment key={key}>
            <Label x={14} y={54 + index * 20} size={11} mono muted={!hot}>
              {key}
            </Label>
            <Label x={286} y={54 + index * 20} size={11} mono anchor="end" weight={hot ? 600 : undefined}>
              {`{${positions}}`}
            </Label>
          </Fragment>
        ))}
        <Label x={14} y={222} size={10} muted>
          positions relative to the segment base, stored as bitmaps
        </Label>
      </At>
      <At x={400} y={40} show={on(3)}>
        <Box w={320} h={110} label="position → byte offset" align="top" />
        <Label x={14} y={58} size={11} mono>
          0→13 1→94 2→186 3→265
        </Label>
        <Label x={14} y={78} size={11} mono>
          <tspan style={{ fill: "var(--color-fd-primary)", fontWeight: 600 }}>4→358</tspan> 5→451 6→543
        </Label>
        <Label x={14} y={100} size={10} muted>
          not on disk: rebuilt from the segment at startup
        </Label>
      </At>
      <At x={400} y={176} show={on(3)}>
        <Label size={11} muted>
          p4 adds position 4 under its type and under each of its two tags
        </Label>
      </At>

      {/* segment S0 */}
      <At x={BAR_X} y={BAR_Y} show={step <= 4}>
        <SegmentBar step={step} written={written} sealed={sealed} />
      </At>

      {/* new segment S1 */}
      <At x={BAR_X} y={306} show={on(4)}>
        <Label y={-8} size={11} mono muted>
          00000000000000000007.seg · active · base 7
        </Label>
        <rect width={640} height={30} rx={4} style={{ fill: "var(--color-fd-muted)", stroke: "var(--color-fd-primary)" }} />
        <rect width={13} height={30} style={{ fill: "var(--color-fd-accent)" }} />
        <rect x={13} width={86} height={30} style={{ fill: accent(30) }} />
        <Label x={56} y={19} size={10.5} mono anchor="middle">
          p7
        </Label>
      </At>
      <At x={80} y={40} show={on(4)}>
        <Box w={330} h={110} label="The next record needs about 90 bytes" align="top" tone="warn" />
        <Label x={14} y={60} size={11.5}>
          S0 has 640 − 622 = 18 bytes left.
        </Label>
        <Label x={14} y={80} size={11.5}>
          S0 is sealed and trimmed to 622 bytes.
        </Label>
        <Label x={14} y={100} size={11.5}>
          The record goes to a new segment, S1.
        </Label>
      </At>

      {/* index files */}
      <At x={20} y={44} show={on(5)}>
        <FileCards />
      </At>

      {/* whole log */}
      <At show={step >= 6}>
        <LogView step={step} />
      </At>
    </>
  )
}

function SegmentBar({ step, written, sealed }: { step: number; written: (position: number) => boolean; sealed: boolean }) {
  return (
    <g>
      <Label y={-10} size={11} mono muted>
        {`00000000000000000000.seg · ${sealed ? "sealed · 622 bytes" : "active · 640 bytes preallocated"}`}
      </Label>
      <rect
        width={sealed ? 622 : 640}
        height={BAR_H}
        rx={4}
        style={{
          fill: "var(--color-fd-muted)",
          stroke: sealed ? "var(--color-fd-border)" : "var(--color-fd-primary)",
          transition: "width 700ms cubic-bezier(0.4, 0, 0.2, 1), stroke 400ms ease",
        }}
      />
      <rect width={13} height={BAR_H} style={{ fill: "var(--color-fd-accent)" }} />
      {records.map((record) => {
        const fresh = record.position === 4 && (step === 1 || step === 3)
        const shown = written(record.position)
        return (
          <g
            key={record.position}
            className="kx-move"
            style={{ opacity: shown ? 1 : 0, transform: `translateY(${shown ? 0 : -60}px)` }}
          >
            <rect
              x={record.start}
              width={record.size - 1}
              height={BAR_H}
              className="kx-tone"
              style={{ fill: fresh ? accent(45) : accent(16), stroke: fresh ? "var(--color-fd-primary)" : "none" }}
            />
            <Label x={record.start + record.size / 2} y={16} size={10.5} mono anchor="middle" weight={600}>
              {`p${record.position}`}
            </Label>
            <Label x={record.start + record.size / 2} y={31} size={8.5} anchor="middle" muted>
              {record.tags}
            </Label>
            <Label x={record.start} y={BAR_H + 14} size={9} mono muted>
              {record.start}
            </Label>
          </g>
        )
      })}
      <g className="kx-move" style={{ opacity: step === 0 ? 1 : 0 }}>
        <Label x={640} y={-10} size={11} anchor="end" muted>
          event bytes are not read for the check
        </Label>
      </g>
    </g>
  )
}

function RecordAnatomy() {
  const cells: Array<[string, number, boolean, string?]> = [
    ["CRC32C", 54, false, "4 B"],
    ["length", 54, false, "4 B"],
    ["flags", 36, false, "1 B"],
    ["position", 56, true],
    ["id", 28, false],
    ["type", 40, false],
    ["version", 50, false],
    ["timestamp", 62, false],
    ["metadata", 58, false],
    ["tags", 44, true],
    ["payload", 52, false],
  ]
  let x = 0
  return (
    <g>
      {cells.map(([name, width, hot, size], index) => {
        const header = index < 3
        const cell = (
          <g key={name}>
            <rect
              x={x}
              width={width - 2}
              height={34}
              rx={3}
              style={{ fill: header ? "var(--color-fd-accent)" : accent(hot ? 32 : 12), stroke: "var(--color-fd-border)" }}
            />
            <Label x={x + width / 2 - 1} y={size ? 15 : 21} size={10} anchor="middle">
              {name}
            </Label>
            {size && (
              <Label x={x + width / 2 - 1} y={28} size={9} anchor="middle" muted mono>
                {size}
              </Label>
            )}
          </g>
        )
        x += width
        return cell
      })}
      <Label y={56} size={10.5} mono muted>
        9-byte header · the checksum covers the flags and the body
      </Label>
      <Label y={74} size={10.5} mono muted>
        84-byte body · the server writes position 4 into its first 8 bytes
      </Label>
      <Label y={92} size={10.5} mono muted>
        p4 occupies bytes 358 to 451 of the file
      </Label>
    </g>
  )
}

function CommitTimeline() {
  const lanes = ["Client A · p4", "Client B · p5", "Client C · p6", "Sync thread", "Disk", "Watermark"]
  const laneY = (index: number) => 24 + index * 42
  const x0 = 130
  return (
    <g>
      {lanes.map((name, index) => (
        <Fragment key={name}>
          <Label y={laneY(index) + 4} size={11} muted>
            {name}
          </Label>
          <line x1={x0} x2={760} y1={laneY(index)} y2={laneY(index)} style={{ stroke: "var(--color-fd-border)" }} strokeDasharray="2 4" />
        </Fragment>
      ))}
      <Reveal at={300}>
      <rect x={156} y={4} width={128} height={104} rx={6} style={{ fill: "color-mix(in oklab, var(--color-fd-primary) 8%, transparent)", stroke: "var(--color-fd-primary)" }} strokeDasharray="4 3" />
      <Label x={162} y={-2} size={10.5} mono>
        wave 1
      </Label>
      </Reveal>
      <Reveal at={3000}>
      <rect x={416} y={90} width={100} height={60} rx={6} style={{ fill: "color-mix(in oklab, var(--color-fd-primary) 8%, transparent)", stroke: "var(--color-fd-primary)" }} strokeDasharray="4 3" />
      <Label x={422} y={164} size={10.5} mono>
        wave 2
      </Label>
      <Marker x={430} y={laneY(2)} text="write" />
      </Reveal>
      <Reveal at={500}>
        <Marker x={175} y={laneY(0)} text="write" />
      </Reveal>
      <Reveal at={1100}>
        <Marker x={235} y={laneY(1)} text="write" />
      </Reveal>
      <Reveal at={1800}>
        <Marker x={292} y={laneY(3)} text="seal wave 1" />
      </Reveal>
      <Reveal at={2300}>
      <rect x={297} y={laneY(4) - 9} width={186} height={18} rx={4} style={{ fill: "var(--color-fd-warning)", opacity: 0.55 }} />
      <Label x={390} y={laneY(4) + 4} size={10.5} anchor="middle">
        fdatasync, wave 1
      </Label>
      </Reveal>
      <Reveal at={5200}>
      <Marker x={546} y={laneY(3)} text="seal wave 2" />
      <rect x={551} y={laneY(4) - 9} width={144} height={18} rx={4} style={{ fill: "var(--color-fd-warning)", opacity: 0.55 }} />
      <Label x={623} y={laneY(4) + 4} size={10.5} anchor="middle">
        fdatasync, wave 2
      </Label>
      </Reveal>
      <Label x={x0} y={laneY(5) + 4} size={11} mono>
        4
      </Label>
      <Reveal at={4200}>
      <Label x={488} y={laneY(5) + 4} size={11} mono weight={600}>
        → 6
      </Label>
      </Reveal>
      <Reveal at={7000}>
      <Label x={700} y={laneY(5) + 4} size={11} mono weight={600}>
        → 7
      </Label>
      </Reveal>
      <Reveal at={4400}>
      <Arrow x1={492} y1={laneY(5) - 10} x2={492} y2={laneY(0) + 8} tone="accent" />
      <Label x={498} y={laneY(0) - 6} size={10} mono>
        acknowledged, marker 5
      </Label>
      <Arrow x1={506} y1={laneY(5) - 10} x2={506} y2={laneY(1) + 8} tone="accent" />
      <Label x={512} y={laneY(1) - 6} size={10} mono>
        acknowledged, marker 6
      </Label>
      </Reveal>
      <Reveal at={7200}>
      <Arrow x1={704} y1={laneY(5) - 10} x2={704} y2={laneY(2) + 8} tone="accent" />
      <Label x={712} y={laneY(2) - 6} size={10} mono anchor="end">
        acknowledged, marker 7
      </Label>
      </Reveal>
      <Label y={laneY(5) + 40} size={10.5} muted>
        With replicas, the watermark is the position a quorum of nodes has reached, and acknowledgements wait for that quorum.
      </Label>
    </g>
  )
}

function Marker({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={5} style={{ fill: "var(--color-fd-primary)" }} />
      <Label x={x + 9} y={y - 7} size={10} muted>
        {text}
      </Label>
    </g>
  )
}

function FileCards() {
  return (
    <g>
      <Box w={200} h={320} label="S0.seg · 622 B" sub="the records, unchanged" align="top" />
      <At x={14} y={64}>
        {["header 13 B", ...records.map((record) => `p${record.position}  ${record.size} B`)].map((line, index) => (
          <Label key={line} y={index * 24} size={11} mono muted={index === 0}>
            {line}
          </Label>
        ))}
      </At>

      <At x={220} y={0}>
        <Box w={300} h={320} label="S0.keys · key table · 812 B" sub="written first" align="top" tone="accent" />
        <At x={14} y={64}>
          <Label size={10.5} muted>
            header 128 · bitmaps 160 · keys 191 · directory 320
          </Label>
          <Label y={24} size={10.5} weight={600}>
            Directory, sorted by key hash
          </Label>
          {[
            ["6160…", "type ToolRented", "3 4"],
            ["a6f2…", "type ToolAdded", "0 2 6"],
            ["b9b6…", "customerId=ada", "1 3 4"],
            ["c94f…", "toolId=t-2", "2 3"],
            ["d6ca…", "customerId=bob", "5"],
            ["e252…", "toolId=t-1", "0 4"],
            ["e8eb…", "toolId=t-3", "6"],
            ["fa52…", "type CustomerRegistered", "1 5"],
          ].map(([hash, key, positions], index) => (
            <Fragment key={key}>
              <Label y={48 + index * 24} size={10} mono muted>
                {hash}
              </Label>
              <Label x={46} y={48 + index * 24} size={10.5} mono>
                {key}
              </Label>
              <Label x={272} y={48 + index * 24} size={10.5} mono anchor="end">
                {`{${positions}}`}
              </Label>
            </Fragment>
          ))}
        </At>
      </At>

      <At x={540} y={0}>
        <Box w={220} h={320} label="S0.idx · locator · 164 B" sub="written second" align="top" tone="accent" />
        <At x={14} y={64}>
          <Label size={10.5} muted>
            header 128 · offsets 28 · checks 4
          </Label>
          <Label y={24} size={10.5} weight={600}>
            Byte offset of each event
          </Label>
          {records.map((record, index) => (
            <Label key={record.position} y={48 + index * 24} size={10.5} mono>
              {`p${record.position} → ${record.start}`}
            </Label>
          ))}
        </At>
      </At>
      <Label y={346} size={10.5} muted>
        Each file is written as name.tmp, synced and renamed. Each section carries CRC32C checks, verified the first time it is read.
      </Label>
    </g>
  )
}

// ── the whole log (steps 7 to 11) ─────────────────────────────────────────

const SEG_X = 40
const SEG_W = 64
const SEG_GAP = 8
const SEG_Y = 70
const segX = (index: number) => SEG_X + index * (SEG_W + SEG_GAP)
const MERGED_W = segX(8) - segX(0) - SEG_GAP

function LogView({ step }: { step: number }) {
  const tiered = step === 10
  return (
    <g>
      {Array.from({ length: 10 }, (_, index) => {
        const active = index === 9
        const evicted = tiered && index === 0
        return (
          <g key={index} style={{ transform: `translate(${segX(index)}px, ${SEG_Y}px)` }}>
            <rect
              width={SEG_W}
              height={46}
              rx={6}
              className="kx-tone"
              style={{
                fill: evicted ? "transparent" : active ? "var(--color-fd-muted)" : "var(--color-fd-card)",
                stroke: active ? "var(--color-fd-primary)" : "var(--color-fd-border)",
              }}
              strokeDasharray={evicted ? "4 3" : undefined}
            />
            <Label x={SEG_W / 2} y={19} size={11.5} anchor="middle" weight={600}>
              {`S${index}`}
            </Label>
            <Label x={SEG_W / 2} y={35} size={9.5} anchor="middle" muted mono>
              {active ? "active" : evicted ? ".idx only" : ".seg .idx"}
            </Label>
            {index < 8 && step === 6 && (
              <Reveal at={5400} out>
                <rect y={52} width={SEG_W} height={18} rx={4} style={{ fill: accent(18), stroke: "var(--color-fd-primary)" }} />
                <Label x={SEG_W / 2} y={65} size={9.5} anchor="middle" mono>
                  .keys
                </Label>
              </Reveal>
            )}
            {index === 8 && (
              <g>
                <rect y={52} width={SEG_W} height={18} rx={4} style={{ fill: accent(18), stroke: "var(--color-fd-primary)" }} />
                <Label x={SEG_W / 2} y={65} size={9.5} anchor="middle" mono>
                  .keys
                </Label>
              </g>
            )}
            <Label y={-8} size={9} mono muted>
              {index * 7}
            </Label>
          </g>
        )
      })}

      <g key={step === 6 ? "merging" : "merged"} style={{ transform: `translate(${segX(0)}px, ${SEG_Y + 76}px)` }}>
        <Reveal at={step === 6 ? 1400 : 0}>
          <rect width={MERGED_W} height={18} rx={4} style={{ fill: accent(30), stroke: "var(--color-fd-primary)" }} />
          <Label x={MERGED_W / 2} y={13} size={10} anchor="middle" mono>
            index/…0000-…0056.keys · one merged table for S0 to S7
          </Label>
        </Reveal>
      </g>

      <g style={{ transform: `translate(${segX(9) + 50}px, ${SEG_Y - 22}px)` }}>
        <line y1={0} y2={100} style={{ stroke: "var(--color-fd-success)" }} strokeWidth={2} />
        <Label x={-4} y={-4} size={10} mono anchor="end" muted>
          watermark 66
        </Label>
      </g>

      {/* merging */}
      <At x={40} y={214} show={step === 6}>
        {[
          ["Build", "the 8 .keys files are merged into one, written as .tmp, synced, renamed"],
          ["Commit", "index/MANIFEST is rewritten to name the new table"],
          ["Switch", "new queries use the merged table; running queries keep their files"],
          ["Delete", "the 8 old .keys files are removed"],
        ].map(([name, text], index) => (
          <Reveal key={`${name}-${step}`} at={400 + index * 1600}>
            <circle cx={9} cy={index * 36 + 8} r={10} style={{ fill: "var(--color-fd-primary)" }} />
            <text
              x={9}
              y={index * 36 + 12}
              textAnchor="middle"
              style={{ fill: "var(--color-fd-primary-foreground)", fontSize: 10.5, fontWeight: 700 }}
            >
              {index + 1}
            </text>
            <Label x={28} y={index * 36 + 12} size={12} weight={600}>
              {name}
            </Label>
            <Label x={92} y={index * 36 + 12} size={11.5} muted>
              {text}
            </Label>
          </Reveal>
        ))}
        <Label y={160} size={10.5} muted>
          Only committed segments are merged: sealed, with a key table on disk, and below the watermark.
        </Label>
        <Label y={178} size={10.5} muted>
          S8 keeps its own key table until seven more segments join it. A second level merges 64 segments, and so on.
        </Label>
      </At>

      {/* query */}
      <At x={40} y={204} show={step === 7}>
        <Box w={720} h={34} label="query: types [ToolRented], tags [toolId=t-1]" mono />
        {[
          { x: 0, w: MERGED_W, name: "merged table · positions 0 to 55", tagName: "toolId=t-1", typeName: "type ToolRented", tag: "{0 4 9 30 33}", type: "{3 4 11 30 40}", hits: "{4 30}" },
          { x: segX(8) - segX(0), w: SEG_W, name: "S8 .keys", tagName: "t-1", typeName: "type", tag: "{58 61}", type: "{58}", hits: "{58}" },
          { x: segX(9) - segX(0), w: SEG_W, name: "active", tagName: "t-1", typeName: "type", tag: "{64}", type: "{64}", hits: "{64}" },
        ].map((source, index) => (
          <g key={`${source.name}-${step}`} style={{ transform: `translate(${source.x}px, 50px)` }}>
            <Reveal at={600 + index * 1500}>
            <rect width={source.w} height={114} rx={6} style={{ fill: "var(--color-fd-card)", stroke: "var(--color-fd-primary)" }} />
            <Label x={8} y={17} size={9.5} muted>
              {source.name}
            </Label>
            <Label x={8} y={38} size={9.5} mono>
              {source.tagName}
            </Label>
            <Label x={8} y={52} size={9} mono muted>
              {source.tag}
            </Label>
            <Label x={8} y={72} size={9.5} mono>
              {source.typeName}
            </Label>
            <Label x={8} y={86} size={9} mono muted>
              {source.type}
            </Label>
            <Label x={8} y={105} size={10} mono weight={700}>
              {`∩ ${source.hits}`}
            </Label>
            </Reveal>
          </g>
        ))}
        <g key={`result-${step}`}>
        <Reveal at={5200}>
        <At y={196}>
          <Label size={12} weight={600}>
            Result: positions 4, 30, 58, 64
          </Label>
          <Label y={20} size={10.5} muted>
            A key that is missing from a table's directory rules out that whole range without reading a position set.
          </Label>
        </At>
        </Reveal>
        </g>
      </At>

      {/* positions to bytes */}
      <At x={40} y={210} show={step === 8}>
        {[
          ["4", "S0", "S0.idx → 358", "bytes 358 to 451 · CRC ok"],
          ["30", "S4", "S4.idx → offset", "read · CRC ok"],
          ["58", "S8", "S8.idx → offset", "read · CRC ok"],
          ["64", "S9", "in-memory list → offset", "read · CRC ok"],
        ].map(([position, segment, offset, read], index) => (
          <g key={`${position}-${step}`} style={{ transform: `translateY(${index * 42}px)` }}>
            <Reveal at={400 + index * 1200}>
            <rect width={56} height={28} rx={14} style={{ fill: accent(30) }} />
            <Label x={28} y={18} size={11.5} mono anchor="middle" weight={700}>
              {position}
            </Label>
            <Arrow x1={62} y1={14} x2={108} y2={14} />
            <Label x={116} y={18} size={11.5} mono>
              {segment}
            </Label>
            <Arrow x1={150} y1={14} x2={196} y2={14} />
            <Label x={204} y={18} size={11.5} mono>
              {offset}
            </Label>
            <Arrow x1={392} y1={14} x2={438} y2={14} />
            <Label x={446} y={18} size={11.5} mono>
              {read}
            </Label>
            </Reveal>
          </g>
        ))}
        <Label y={190} size={10.5} muted>
          Records are read from memory-mapped segment files. A checksum mismatch fails the read with an error.
        </Label>
      </At>

      {/* streaming */}
      <At x={40} y={214} show={step === 9}>
        <Box w={150} h={120} label="Server" align="top" />
        <Label x={14} y={58} size={11} mono muted>
          head at request
        </Label>
        <Label x={14} y={80} size={14} mono weight={700}>
          66
        </Label>
        <Arrow x1={152} y1={60} x2={198} y2={60} tone="accent" />
        <At x={200} y={20}>
          <Box w={290} h={80} label="Events · 4 records · END" sub="the stored bytes · marker 66" tone="accent" />
        </At>
        <Arrow x1={492} y1={60} x2={538} y2={60} tone="accent" />
        <At x={540} y={0}>
          <Box w={180} h={120} label="Client" align="top" />
          <Label x={14} y={58} size={11} mono muted>
            next append
          </Label>
          <Label x={14} y={80} size={11} mono>
            condition marker 66
          </Label>
        </At>
        <Label y={152} size={10.5} muted>
          A larger result is split into messages of up to 1024 events or 1 MiB. Only the last one carries the marker.
        </Label>
      </At>

      {/* archive */}
      <At x={40} y={214} show={tiered}>
        <Box w={300} h={112} label="Archive (object store)" align="top" tone="muted" />
        <Label x={14} y={58} size={11} mono muted>
          segments/0.seg · 0.idx · 0.sum
        </Label>
        <Label x={14} y={78} size={11} mono muted>
          index/…0000-…0056.keys
        </Label>
        <Arrow x1={302} y1={70} x2={418} y2={70} tone="accent" label="bytes 358..451" />
        <At x={420} y={30}>
          <Box w={300} h={80} label="query for position 4" sub="key table and S0.idx are local" align="top" />
        </At>
        <Label y={144} size={10.5} muted>
          A local segment file is deleted only after it is archived and its hash matches the archived copy.
        </Label>
      </At>
    </g>
  )
}
