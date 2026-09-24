---
name: azk-reference
description: Pointer to azk's built-in documentation. Use whenever you're about to run an `azk` subcommand (search, create, get, update, delete, link, reindex, setup, clear) and need its exact JSON output shape or an edge case (empty stdin, partial update, delete cascades) — the CLI documents itself via `azk help [verb]`. For installing azk in the first place, see README.md.
metadata:
  author: leandro
  version: "2.0"
---

# Azk Reference

azk documents itself. Don't rely on this skill for details — ask the CLI:

```bash
azk help          # general usage: what azk is, verbs, output conventions, workflow
azk help <verb>   # one verb's syntax, exact output shape and gotchas
```

`help` prints plain Markdown text; every other verb prints a single JSON value. Remember that exit code isn't a reliable success signal — failures inside a verb print `{ error }` and still exit 0, so check for a top-level `error` key.

If `azk` isn't on `PATH` but you're inside the azk repo itself, `deno task azk help [verb]` does the same.
