# Writing the docs

Each product has two sections, and every page belongs to exactly one of them.

| Section | Answers | Shape |
| --- | --- | --- |
| What is Kronos / What is KronosDB | "what is this part, what is it for, how do I use it" | Reference. One page per part. |
| Using Kronos / Running KronosDB | "how do I get X done" | A tutorial (Getting started) and task guides. |

## Audience

The reader builds an application with Kronos, or runs KronosDB for one. They
are not working on Kronos or KronosDB. Every sentence must help them write,
configure, run or debug their application.

Document what the reader calls, configures, or observes: the functions and
options they use, the behaviour they can see (results, errors, ordering,
timing, what happens on restart or failure), and what they must do about it.

Leave out how it is implemented: internal types and helpers, store or bus
interfaces for implementers, wire formats, on-disk layout, algorithms, phase
protocols, source file names, and exports a normal application never touches.
Someone who needs that reads the code. When a detail changes what the reader
must do (a write is not atomic with the append, a delivery can repeat), state
the consequence and what to do, not the mechanism.

A page is not a list of every export. Show the common path in full, mention
the less common options in a sentence or a table, and stop.

## Reference pages

1. **Opening.** No heading. The first sentence says what the part is. The
   rest of the opening (one or two paragraphs) says what it is for and where
   it sits relative to the other parts, with links.
2. **The body.** One `##` section per thing the reader does or needs to
   understand, named with a noun ("Tags", "Batches", "Results and errors").
   Each section: a paragraph of context, then a short example, then what the
   example did not already show.
3. **`## Options`** (only if the part has options a user sets): one
   `<TypeTable>` per options object, with defaults.
4. **`## Errors`** (only if the reader can meet errors here): what they see
   and what to do about it.
5. **`## Related`.** A short list of links to other pages, one line each.

Reference pages are usually 80 to 200 lines. Over 250 means something
internal got in.

## Guides

1. **Opening.** One paragraph: what you will have when you are done and what
   you need first.
2. **Steps.** `##` per step, named for what the step does ("Create the
   tables", "Wire the processor"). Each step is code plus what the reader must
   know to adapt it. Explanations of how something works are links to the
   reference.
3. **`## Checking it works`.** What to run and what you see.
4. **`## Related`.**

## Rules

1. Say what it is in the first sentence. Plain declarative, no setup.
2. Context before code. Before a code block, one or two sentences say what
   the reader is about to do. After the block, explain only what is new.
   Never open a section with code.
3. One idea per paragraph. Two to five sentences.
4. Never end a paragraph on a slogan. If a sentence would work as a tweet,
   delete it. Do not end a paragraph with a short summarizing sentence.
5. No history. Never describe what used to exist, what was removed or
   renamed, or what Axon or another framework does differently.
6. No narrator. Never "notice that", "note that", "here is the interesting
   part", "that is the whole design", "it is worth".
7. No lists of what something is not. "No container, no registry, no magic"
   is banned. Say what it is.
8. Bold is for a term at the place it is defined, and nowhere else.
9. At most one em dash per paragraph. Prefer a full stop.
10. Prefer the concrete call over the abstract rule. "Wrap the store with
    `postgresSnapshottingEventStore`" beats "snapshotting is a capability tier".
11. Every ` ```ts ` block is an excerpt of a file under `examples/src` that
    passes `bun run check` in `examples/`. Signatures copied from library
    source use ` ```ts signature ` instead and are not checked as excerpts.
12. Headings are nouns or short verb phrases. "Sequences", "Wire the
    processor". Not sentences.
13. Names in code are the domain's names. No single-letter parameters (`state`,
    `payload`, `event`, `message`, `handler`, never `s`, `p`, `e`, `m`, `h`),
    no placeholders (`foo`, `thing`, `x`).
14. Every rejection has a home. A business refusal the caller will act on is a
    command result. An error is for what the caller can only retry or report.
15. Do not sell, defend or apologise. No "powerful", "seamless", "simply",
    "just", "elegant", "out of the box", "under the hood". No claims about
    speed without a number and a link to where it was measured.
16. Explain the design only where the reader needs it to use the part
    correctly, and then in one paragraph. Design rationale is not a section.
17. Literal language. Code returns, calls, reads, writes, stores, throws and
    fails. It does not ask, answer, say, see, know, want, remember, speak or
    tell, and messages do not travel, move through or live anywhere. Write
    "`send` returns the handler's return value", not "the bus answers".
18. DCB is about consistency, not concurrency. A decision's consistency
    boundary is the set of events it depends on, selected by a query over
    types and tags; the append condition stores the decision only if that set
    is unchanged. Never describe DCB as a concurrency mechanism or explain it
    with a race between two users.
19. Write for a competent TypeScript engineer who has not seen Kronos and may
    not know event sourcing or DCB. Define a term the first time a page uses
    it, or link to where it is defined.

## Voice

Direct, second person, unhurried, plain. Like a good man page or the Postgres
manual: precise, complete, a little dry. Sentences of ordinary length. No
rhythm tricks, no punchlines, no rhetorical questions.

## Checks

```sh
cd examples && bun run check        # every example typechecks against kronos-ts HEAD
python3 scripts/check-excerpts.py   # every ts block is an excerpt of an example
python3 scripts/lint-prose.py       # banned phrases, em dashes, bold, slogan endings
```
