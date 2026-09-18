# Program Specification

This program is the whole `azk` command line: a Zettelkasten over Markdown notes. Notes persist as Markdown files with YAML frontmatter under `notes/<id>.md` (the source of truth); `.azk/azk.db` is a derived, gitignored SQLite index (FTS5 + optional embeddings + link graph), fully rebuildable from the notes at any time.

The first argument names a verb — `search`, `create`, `get`, `update`, `delete`, `link` or `reindex` — and `DISPATCH` routes to that verb's chain. Seven chains share one graph, so several nodes are the same implementation wired at more than one place: `nodes/embed.ts` runs as `SEARCH_EMBED`, `CREATE_EMBED`, `UPDATE_EMBED` and `REINDEX_EMBED`, and `nodes/write-note.ts`, `nodes/index-upsert.ts`, `nodes/exists-check.ts`, `nodes/create-links.ts` and `nodes/id-arg.ts` are reused the same way. Two verbs could only share one position if their chains were identical from there to termination, and each ends at its own finish node, so none are — the node file and its tests are what gets reused, not the wiring.

Every node prints at most one JSON value to stdout. Failures are values, not exceptions: a node prints `{ error }` and takes an error edge, and the process still exits 0. Only a bad invocation — an unknown verb, a missing argument, malformed JSON on stdin — reaches `USAGE` and exits 1.

## Nodes

### Dispatch
- Initial node of the program.
- Reads the verb from the command line and passes the remaining arguments to that verb's chain. Its edges name a classification rather than an event, the one deliberate exception to the `onPastTense` convention.
- Transitions to `SEARCH_INPUT`, `CREATE_INPUT`, `GET_ID_ARG`, `UPDATE_ID_ARG`, `DELETE_ID_ARG`, `LINK_INPUT` or `REINDEX_LIST`. An absent or unrecognised verb carries the full usage block and transitions to `USAGE`.

### Usage
- Terminal node of the program, shared by every chain.
- Prints the pending usage message to stderr, leaving stdout for the single JSON value a successful run produces.
- Terminates. The walk then exits 1, because a usage message only ever gets set by a bad invocation.

### Search Input
- Reads the query and an optional result limit from the arguments, resolving the limit to a concrete number so the three ranking nodes agree on how many results they are working towards (5 when unspecified).
- If a query was given, transitions to `SEARCH_KEYWORD`. Otherwise transitions to `USAGE`.

### Search Keyword
- Runs the FTS5 keyword search and scores matches by rank position, best first.
- Queues the query for embedding. An empty keyword result is not a dead end — semantic search can still surface notes sharing no keywords with the query.
- Transitions to `SEARCH_EMBED`.

### Search Embed
- Implemented by `nodes/embed.ts`; also wired at `CREATE_EMBED`, `UPDATE_EMBED` and `REINDEX_EMBED`.
- Embeds the pending text, if any. Never fails: an unreachable embeddings host yields no vector rather than an error.
- Transitions to `SEARCH_SEMANTIC`.

### Search Semantic
- Scores every indexed note against the query vector and keeps the closest few. Contributes nothing when the query could not be embedded, degrading search to keyword-only.
- Transitions to `SEARCH_MERGE_RANK`.

### Search Merge Rank
- Terminal node of the `search` chain.
- Blends the two rankings, best match first. Semantic scoring is additive: it boosts a note that also matched by keyword and admits one that matched only semantically.
- Prints the results and terminates. An empty result set is not an error — it prints `[]` and still terminates normally.

### Create Input
- Reads `{ title, body, tags?, links? }` as JSON on stdin.
- If both `title` and `body` are present, transitions to `CREATE_INIT`. Malformed JSON, or a missing `title` or `body`, transitions to `USAGE`.

### Create Init
- Assembles the new note in memory: a fresh id, matching created/updated timestamps, and the caller's links translated into frontmatter form. The id and timestamps live inside the note rather than beside it, so nothing downstream has to keep them in step.
- Queues the body for embedding. Links are not validated against existing ids here, unlike `link` — a target that doesn't exist becomes a dangling link.
- Transitions to `CREATE_EMBED`.

### Create Embed
- Implemented by `nodes/embed.ts`. See `SEARCH_EMBED`.
- Transitions to `CREATE_WRITE_NOTE`.

### Create Write Note
- Implemented by `nodes/write-note.ts`; also wired at `UPDATE_WRITE_NOTE` and `LINK_WRITE_NOTE`.
- Persists the note to its Markdown file — the source of truth, written before the derived index is touched.
- If written, transitions to `CREATE_INDEX_UPSERT`. Otherwise prints `{ error }` and terminates.

### Create Index Upsert
- Implemented by `nodes/index-upsert.ts`; also wired at `UPDATE_INDEX_UPSERT` and `REINDEX_INDEX_UPSERT`.
- Upserts the note into the SQLite index, hashing the body so a later reindex can tell whether it changed. No embedding leaves any previously stored vector alone.
- If indexed, transitions to `CREATE_LINKS`. Otherwise prints `{ error }` and terminates.

### Create Links
- Implemented by `nodes/create-links.ts`; also wired at `LINK_CREATE_LINKS`.
- Records the pending links in the index's link graph. Nothing to link is not an error.
- If recorded, transitions to `CREATE_FINISH`. Otherwise prints `{ error }` and terminates.

### Create Finish
- Terminal node of the `create` chain.
- Prints the created note's summary, which runs only once the file, the index entry and the links have all been written, so what it reports has actually happened.
- Terminates.

### Get Id Arg
- Implemented by `nodes/id-arg.ts`; also wired at `UPDATE_ID_ARG` and `DELETE_ID_ARG`.
- Reads a note id from the verb's first argument, building its usage line from the verb so one node serves all three.
- If an id was given, transitions to `GET_EXISTS_CHECK`. Otherwise transitions to `USAGE`.

### Get Exists Check
- Implemented by `nodes/exists-check.ts`; also wired at `UPDATE_EXISTS_CHECK` and `DELETE_EXISTS_CHECK`.
- Reads the note by id and attaches it, so downstream nodes don't read it again.
- If found, transitions to `GET`. Otherwise prints `{ error }` and terminates.

### Get
- Terminal node of the `get` chain.
- Prints the note together with every link touching it in either direction.
- Terminates.

### Update Id Arg
- Implemented by `nodes/id-arg.ts`. See `GET_ID_ARG`. This wiring injects a usage line that mentions stdin, since `update` needs both.
- If an id was given, transitions to `UPDATE_INPUT`. Otherwise transitions to `USAGE`.

### Update Input
- Reads a partial `{ title?, body?, tags? }` as JSON on stdin. Every field is optional — an empty object is a valid no-op update.
- If the JSON parsed, transitions to `UPDATE_EXISTS_CHECK`. Otherwise transitions to `USAGE`.

### Update Exists Check
- Implemented by `nodes/exists-check.ts`. See `GET_EXISTS_CHECK`.
- If found, transitions to `UPDATE_MERGE`. Otherwise prints `{ error }` and terminates.

### Update Merge
- Applies the supplied subset of title/body/tags over the existing note and stamps it updated.
- Queues the body for embedding only when a body was supplied — re-embedding a title or tag change would cost a round trip for a vector that wouldn't move.
- Transitions to `UPDATE_EMBED`.

### Update Embed
- Implemented by `nodes/embed.ts`. See `SEARCH_EMBED`.
- Transitions to `UPDATE_WRITE_NOTE`.

### Update Write Note
- Implemented by `nodes/write-note.ts`. See `CREATE_WRITE_NOTE`.
- If written, transitions to `UPDATE_INDEX_UPSERT`. Otherwise prints `{ error }` and terminates.

### Update Index Upsert
- Implemented by `nodes/index-upsert.ts`. See `CREATE_INDEX_UPSERT`.
- If indexed, transitions to `UPDATE_FINISH`. Otherwise prints `{ error }` and terminates.

### Update Finish
- Terminal node of the `update` chain.
- Prints the update confirmation and terminates.

### Delete Id Arg
- Implemented by `nodes/id-arg.ts`. See `GET_ID_ARG`.
- If an id was given, transitions to `DELETE_EXISTS_CHECK`. Otherwise transitions to `USAGE`.

### Delete Exists Check
- Implemented by `nodes/exists-check.ts`. See `GET_EXISTS_CHECK`.
- If found, transitions to `DELETE`. Otherwise prints `{ error }` and terminates.

### Delete
- Terminal node of the `delete` chain.
- Removes the note's Markdown file, its index entry, and any links referencing it in either direction.
- Prints the deletion confirmation and terminates.

### Link Input
- Reads the source id, target id and relation phrase from the arguments.
- If all three were given, transitions to `LINK_VALIDATE`. Otherwise transitions to `USAGE`.

### Link Validate
- Requires both ends of the link to already exist — unlike `create`'s links, which are not validated — then appends the link to the source note's frontmatter.
- If both exist, transitions to `LINK_WRITE_NOTE`. Otherwise prints `{ error }` and terminates.

### Link Write Note
- Implemented by `nodes/write-note.ts`. See `CREATE_WRITE_NOTE`.
- If written, transitions to `LINK_CREATE_LINKS`. Otherwise prints `{ error }` and terminates.

### Link Create Links
- Implemented by `nodes/create-links.ts`. See `CREATE_LINKS`.
- If recorded, transitions to `LINK_FINISH`. Otherwise prints `{ error }` and terminates.
- Note that `link` deliberately does not re-index the note it touches: only the file and the link graph change.

### Link Finish
- Terminal node of the `link` chain.
- Prints the link confirmation and terminates.

### Reindex List
- Seeds the reindex loop from the Markdown files on disk and zeroes the counters the later nodes accumulate into.
- Transitions to `REINDEX_NEXT`.

### Reindex Next
- Takes the next note id off the queue. The only node that decides how long the reindex runs.
- If one remains, transitions to `REINDEX_DETECT_CHANGE`. When the queue is empty, transitions to `REINDEX_PRUNE_ORPHANS`.

### Reindex Detect Change
- Decides whether the current note needs re-embedding, by comparing its body hash against the one the index holds, and counts it as newly indexed or as updated.
- The note is always re-upserted and its links always rebuilt downstream — only the embedding is conditional, because that is the one step costing a network round trip. The pending embed text is cleared when nothing changed, so the loop cannot carry one note's body into the next one's embedding.
- Transitions to `REINDEX_EMBED`. A file that vanished between listing and reading transitions back to `REINDEX_NEXT`.

### Reindex Embed
- Implemented by `nodes/embed.ts`. See `SEARCH_EMBED`.
- Transitions to `REINDEX_INDEX_UPSERT`.

### Reindex Index Upsert
- Implemented by `nodes/index-upsert.ts`. See `CREATE_INDEX_UPSERT`.
- If indexed, transitions to `REINDEX_REPLACE_LINKS`. Otherwise prints `{ error }` and terminates, abandoning the rest of the queue.

### Reindex Replace Links
- Rebuilds the current note's outgoing links in the index from its own frontmatter. Runs for every note, changed or not, so a hand-edit that only touched frontmatter links is still picked up.
- Transitions back to `REINDEX_NEXT`, closing the loop.

### Reindex Prune Orphans
- Drops index entries whose Markdown file no longer exists, keeping the index in step with the notes directory.
- Transitions to `REINDEX_FINISH`.

### Reindex Finish
- Terminal node of the `reindex` chain.
- Prints the reindex summary and terminates.

## Shared State

One state is shared by every chain. `argv` is the only required field: a field is required only if every verb sets it before any node reads it, and nothing else qualifies. Each node declares just the fields it touches, and this state stays a structural supertype of all of them.

- `argv`: The raw command line.
- `verb`: The matched verb, lowercased.
- `args`: The remaining arguments, verb removed.
- `usage`: The message `USAGE` should print. Its presence is what makes the run exit 1.
- `error`: The message a failing node already printed.
- `id`: The note being worked on — from an argument, or the reindex loop's cursor.
- `note`: That note, once read from disk or assembled in memory.
- `textToEmbed`: Text queued for embedding, set only when an embedding is wanted.
- `embedding`: The resulting vector, or `null` when none was produced.
- `fromId`: The note the pending links point out of.
- `links`: Caller-supplied links as `{ toId, relation }` — never a note's own `{ to, relation }` frontmatter form, which stays inside `note`.
- `title`, `body`, `tags`: The create/update input.
- `toId`, `relation`: The link input.
- `query`, `limit`: The search input.
- `keywordResults`, `semanticResults`: The two rankings awaiting the blend.
- `allIds`, `remainingIds`: The reindex queue.
- `indexed`, `updated`, `removed`, `total`: The reindex counters.
