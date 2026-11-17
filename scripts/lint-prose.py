#!/usr/bin/env python3
"""Flag prose patterns STYLE.md bans. Usage: lint-prose.py [files...] (default: all pages)."""
import glob, re, sys

BANNED = [
    r"\bsimply\b", r"\bjust\b", r"\bmerely\b", r"\bseamless", r"\bpowerful\b", r"\belegant",
    r"out of the box", r"under the hood", r"\bnotice\b", r"\bnote that\b", r"it is worth",
    r"it's worth", r"\binteresting\b", r"the whole (point|design|story|model|thing)",
    r"is the point", r"load-bearing", r"and nothing (else|more)", r"\bthat's it\b",
    r"\bcrucially\b", r"\bimportantly\b", r"\bin other words\b", r"\bmagic\b",
    r"\bboilerplate\b", r"\bceremony\b", r"used to\b", r"\bno longer\b", r"\bis gone\b",
    r"\bwas removed\b", r"\brenamed\b", r"\bdeprecated\b", r"\bblazing", r"\bheadache",
    r"\bfirst-class\b", r"\bgame.?chang", r"\bunder the covers\b", r"\bbattle.tested\b",
    r"\bmoves? through\b", r"\btravel(s|led)?\b", r"\bjourney", r"\blives? (in|on|with|beside)\b",
    r"\bspeaks?\b", r"\bknows?\b", r"\bwants?\b", r"\bremembers?\b", r"\bcares? about\b",
    r"\basks?\b", r"\banswer(s|ed)?\b", r"\bsays?\b", r"\bsees?\b", r"\btells?\b",
    r"\bis made of\b", r"\bfor concurrency\b", r"\bconcurrency control\b",
    r"\b[\w/-]+\.(ts|rs|toml)\b(?!`)", r"\bcrates/", r"\bpackages/[a-z]", r"\bsrc/",
    r"\bno [a-z]+, no [a-z]+", r"\bnot [a-z ]+, but\b", r"\bthe answer is\b", r"\?\s*$",
]

def paragraphs(text):
    text = re.sub(r"^---\n.*?\n---\n", "", text, flags=re.S)
    text = re.sub(r"```.*?```", "", text, flags=re.S)
    for block in re.split(r"\n\s*\n", text):
        block = block.strip()
        if not block or block.startswith(("<", "#", "import ")):
            continue
        if re.match(r"([-*|]|\d+\.)\s", block):
            yield block, True
        else:
            yield block, False

def lint(path):
    problems = []
    text = open(path).read()
    lines = text.count("\n")
    if "/guides/" not in path and "getting-started" not in path and lines > 260:
        problems.append(f"{lines} lines: a reference page over 260 lines has internals in it")
    for block, is_list in paragraphs(text):
        prose = re.sub(r"`[^`]*`", "`code`", block)
        prose = re.sub(r"\]\([^)]*\)", "]", prose)
        first = block.splitlines()[0][:70]
        for pattern in BANNED:
            if re.search(pattern, prose, re.I | re.M):
                problems.append(f"banned /{pattern}/: {first}")
        if prose.count("—") > 1:
            problems.append(f"{prose.count('—')} em dashes: {first}")
        if len(re.findall(r"\*\*[^*]+\*\*", prose)) > 1:
            problems.append(f"more than one bold term: {first}")
        if not is_list:
            sentences = [s for s in re.split(r"(?<=[.!])\s+", prose.strip()) if s]
            if len(sentences) >= 3 and len(sentences[-1].split()) <= 7:
                problems.append(f"short closing sentence (slogan?) '{sentences[-1]}': {first}")
            if len(sentences) > 7:
                problems.append(f"{len(sentences)} sentences in one paragraph: {first}")
    return problems

files = sys.argv[1:] or sorted(glob.glob("content/docs/**/*.mdx", recursive=True))
total = 0
for path in files:
    found = lint(path)
    total += len(found)
    for problem in found:
        print(f"{path}: {problem}")
print(f"{total} problems in {len(files)} files")
sys.exit(1 if total else 0)
