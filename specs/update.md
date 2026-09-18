# Program Specification

This program is the `update` verb of the `azk` command line: it applies a partial edit to an existing Zettelkasten note. Notes persist as Markdown files with YAML frontmatter under `notes/<id>.md` (the source of truth); `.azk/azk.db` is a derived, gitignored SQLite index (FTS5 + optional embeddings + link graph), fully rebuildable from the notes by the `reindex` walk.

`update` needs both an id on the command line and JSON on stdin, so it is the one walk with two ways to be invoked badly. The Markdown file is rewritten before the derived index is touched.

Every node prints at most one JSON value to stdout. Failures are values, not exceptions: a node prints `{ error }` and takes an error edge, and the process still exits 0. Only a bad invocation — no id, or malformed JSON — reaches `USAGE` and exits 1.

## Nodes

### Id Arg
- Initial node of the program.
- Implemented by `nodes/id-arg.ts`; also used by the `get` and `delete` walks.
- Reads a note id from the first argument. This walk injects its own usage line, because `update` needs stdin as well as an id and the default line mentions only the id.
- If an id was given, transitions to `INPUT`. Otherwise transitions to `USAGE`.

### Input
- Reads a partial `{ title?, body?, tags? }` as JSON on stdin. Every field is optional — an empty object is a valid no-op update.
- If the JSON parsed, transitions to `EXISTS_CHECK`. Otherwise transitions to `USAGE`.

### Exists Check
- Implemented by `nodes/exists-check.ts`; also used by the `get` and `delete` walks.
- Reads the note by id and attaches it, so downstream nodes don't read it again.
- If found, transitions to `MERGE`. Otherwise prints `{ error }` and terminates.

### Merge
- Applies the supplied subset of title/body/tags over the existing note and stamps it updated.
- Queues the body for embedding **only** when a body was supplied — re-embedding a title or tag change would cost a network round trip for a vector that wouldn't move.
- Transitions to `EMBED`.

### Embed
- Implemented by `nodes/embed.ts`; also used by the `search`, `create` and `reindex` walks.
- Embeds the pending text, if any. Never fails: an unreachable embeddings host yields no vector rather than an error.
- Nothing queued yields no vector, which `INDEX_UPSERT` reads as "leave the stored one alone". That chain — no body supplied, so nothing queued, so no vector, so the existing embedding survives — is what keeps a title-only edit from discarding the note's vector, and it holds only while both `textToEmbed` and `embedding` are carried through the walk.
- Transitions to `WRITE_NOTE`.

### Write Note
- Implemented by `nodes/write-note.ts`; also used by the `create` and `link` walks.
- Persists the note to its Markdown file — the source of truth, written before the derived index is touched.
- If written, transitions to `INDEX_UPSERT`. Otherwise prints `{ error }` and terminates.

### Index Upsert
- Implemented by `nodes/index-upsert.ts`; also used by the `create` and `reindex` walks.
- Upserts the note into the SQLite index, hashing the body so a later reindex can tell whether it changed. No embedding leaves any previously stored vector alone.
- If indexed, transitions to `FINISH`. Otherwise prints `{ error }` and terminates.

### Finish
- Terminal node of the program.
- Prints the update confirmation, which runs only once the file and the index entry have both been rewritten.
- Terminates.

### Usage
- Terminal node, reached from `ID_ARG` or `INPUT`.
- Implemented by `nodes/usage.ts`; also used by every other walk that can be invoked badly.
- Prints the pending message to stderr, leaving stdout for the single JSON value a successful run produces.
- Terminates. The walk then exits 1.

## Shared State

`verb` and `args` are required — the walk seeds both. `verb` is carried for symmetry with the other two `ID_ARG` walks; this one's injected usage line doesn't consult it.

- `verb`: Always `update` here.
- `args`: The verb's arguments.
- `usage`: The message `USAGE` should print. Its presence is what makes the run exit 1.
- `error`: The message a failing node already printed.
- `id`: The note being updated.
- `title`, `body`, `tags`: The partial input, each absent when not supplied.
- `note`: The existing note, then the merged one.
- `textToEmbed`: The new body, queued only when one was supplied.
- `embedding`: The resulting vector, or `null` when none was wanted or none could be produced.
