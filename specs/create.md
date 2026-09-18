# Program Specification

This program is the `create` verb of the `azk` command line: it writes a new Zettelkasten note. Notes persist as Markdown files with YAML frontmatter under `notes/<id>.md` (the source of truth); `.azk/azk.db` is a derived, gitignored SQLite index (FTS5 + optional embeddings + link graph), fully rebuildable from the notes by the `reindex` walk.

The whole input is JSON on stdin — `create` takes no arguments. The Markdown file is written before the derived index is touched, and the summary is printed only once the file, the index entry and the links have all landed.

Every node prints at most one JSON value to stdout. Failures are values, not exceptions: a node prints `{ error }` and takes an error edge, and the process still exits 0. Only a bad invocation — malformed JSON, or a missing `title` or `body` — reaches `USAGE` and exits 1.

## Nodes

### Input
- Initial node of the program.
- Reads `{ title, body, tags?, links? }` as JSON on stdin.
- If both `title` and `body` are present, transitions to `INIT`. Malformed JSON, or a missing `title` or `body`, transitions to `USAGE`.

### Init
- Assembles the new note in memory: a fresh id, matching created/updated timestamps, and the caller's links translated into frontmatter form. The id and timestamps live inside the note rather than beside it, so nothing downstream has to keep them in step.
- Names the new note as the source the pending links point out of, and queues the body for embedding.
- Links are not validated against existing ids here, unlike the `link` walk — a target that doesn't exist becomes a dangling link, and `reindex` won't catch it either.
- Transitions to `EMBED`.

### Embed
- Implemented by `nodes/embed.ts`; also used by the `search`, `update` and `reindex` walks.
- Embeds the pending text. Never fails: an unreachable embeddings host yields no vector rather than an error.
- Transitions to `WRITE_NOTE`.

### Write Note
- Implemented by `nodes/write-note.ts`; also used by the `update` and `link` walks.
- Persists the note to its Markdown file — the source of truth, written before the derived index is touched.
- If written, transitions to `INDEX_UPSERT`. Otherwise prints `{ error }` and terminates.

### Index Upsert
- Implemented by `nodes/index-upsert.ts`; also used by the `update` and `reindex` walks.
- Upserts the note into the SQLite index, hashing the body so a later reindex can tell whether it changed. No embedding leaves any previously stored vector alone.
- If indexed, transitions to `LINKS`. Otherwise prints `{ error }` and terminates.

### Links
- Implemented by `nodes/create-links.ts`; also used by the `link` walk.
- Records the pending links in the index's link graph. Nothing to link is not an error.
- If recorded, transitions to `FINISH`. Otherwise prints `{ error }` and terminates.

### Finish
- Terminal node of the program.
- Prints the created note's summary, which runs only once the file, the index entry and the links have all been written, so what it reports has actually happened.
- Terminates.

### Usage
- Terminal node, reached only from `INPUT`.
- Implemented by `nodes/usage.ts`; also used by every other walk that can be invoked badly.
- Prints the pending message to stderr, leaving stdout for the single JSON value a successful run produces. Note that `INPUT`'s rejections are themselves JSON — `{"error":"..."}` — so `create` is the one walk that prints JSON to stderr.
- Terminates. The walk then exits 1.

## Shared State

Nothing is seeded — `create` takes no arguments, so every field is written by a node upstream of whoever reads it.

- `usage`: The message `USAGE` should print. Its presence is what makes the run exit 1.
- `error`: The message a failing node already printed.
- `title`, `body`, `tags`: The caller's input.
- `links`: Caller-supplied links as `{ toId, relation }` — never a note's own `{ to, relation }` frontmatter form, which stays inside `note`. Both the input to `INIT` and part of what `FINISH` prints.
- `fromId`: The new note's id, set by `INIT` for `LINKS` to point the links out of. It reads like a `link`-only field, but dropping it here would leave every created link with no source.
- `note`: The assembled note.
- `textToEmbed`: The body, queued for embedding.
- `embedding`: The resulting vector, or `null` when none was produced.
