# Program Specification

This program is the `search` verb of the `azk` command line: it ranks Zettelkasten notes against a query. Notes persist as Markdown files with YAML frontmatter under `notes/<id>.md` (the source of truth); `.azk/azk.db` is a derived, gitignored SQLite index (FTS5 + optional embeddings + link graph), fully rebuildable from the notes by the `reindex` walk.

Search reads only the index, never the Markdown files. It blends two rankings — keyword and semantic — and degrades to keyword-only rather than failing when no embeddings host is reachable.

Every node prints at most one JSON value to stdout. Only a bad invocation — a missing query — reaches `USAGE` and exits 1; anything else exits 0.

## Nodes

### Input
- Initial node of the program.
- Reads the query and an optional result limit from the arguments, resolving the limit to a concrete number so the three ranking nodes agree on how many results they are working towards (5 when unspecified).
- If a query was given, transitions to `KEYWORD`. Otherwise transitions to `USAGE`.

### Keyword
- Runs the FTS5 keyword search and scores matches by rank position, best first.
- Queues the query for embedding. An empty keyword result is not a dead end — semantic search can still surface notes sharing no keywords with the query.
- Transitions to `EMBED`.

### Embed
- Implemented by `nodes/embed.ts`; also used by the `create`, `update` and `reindex` walks.
- Embeds the pending text. Never fails: an unreachable embeddings host yields no vector rather than an error.
- Transitions to `SEMANTIC`.

### Semantic
- Scores every indexed note against the query vector and keeps the closest few. Contributes nothing when the query could not be embedded, degrading search to keyword-only.
- Transitions to `MERGE_RANK`.

### Merge Rank
- Terminal node of the program.
- Blends the two rankings, best match first. Semantic scoring is additive: it boosts a note that also matched by keyword and admits one that matched only semantically.
- Prints the results and terminates. An empty result set is not an error — it prints `[]` and still terminates normally.

### Usage
- Terminal node, reached only from `INPUT`.
- Implemented by `nodes/usage.ts`; also used by every other walk that can be invoked badly.
- Prints the pending usage message to stderr, leaving stdout for the single JSON value a successful run produces.
- Terminates. The walk then exits 1.

## Shared State

`args` is the only required field — the walk seeds it from the command line. Every other field is written by a node upstream of whoever reads it.

- `args`: The verb's arguments.
- `usage`: The message `USAGE` should print. Its presence is what makes the run exit 1.
- `query`: The search query.
- `limit`: How many results to return, resolved to a number by `INPUT`.
- `textToEmbed`: The query, queued for embedding. Search embeds the *query*, not a note — dropping this field and `embedding` would silently reduce it to keyword-only.
- `embedding`: The query vector, or `null` when none could be produced.
- `keywordResults`, `semanticResults`: The two rankings awaiting the blend.
