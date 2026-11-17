#!/usr/bin/env python3
"""Every ts fence in the docs must be an excerpt of a file under examples/src."""
import re, glob, os, sys
ex = "".join(open(f).read() for f in glob.glob("examples/src/**/*.ts", recursive=True))
lines = set(l.strip() for l in ex.splitlines() if l.strip())
bad = 0
for f in sorted(glob.glob("content/docs/**/*.mdx", recursive=True)):
    un = []
    for block in re.findall(r"```ts\n(.*?)```", open(f).read(), re.S):
        for l in block.splitlines():
            t = l.strip()
            if not t or t.startswith("//") or t in ("}", "})", "],", "}),", ")", "{", "]", "})),"): continue
            if t not in lines and not any(t in e for e in lines): un.append(t)
    if un:
        bad += len(un); print(f"{f}: {len(un)} unmatched"); [print("   ", u[:120]) for u in un[:4]]
print("unmatched lines:", bad); sys.exit(1 if bad else 0)
