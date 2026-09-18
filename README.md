# azk

A Zettelkasten CLI for coding agents. `azk` gives an AI coding assistant a durable, searchable note store so design decisions, constraints, and gotchas compound across sessions instead of being rediscovered every time.

It's built as a single [Ambler](https://github.com/argenkiwi/ambler-ts) walk: one state machine whose entry node dispatches on the verb (`search`, `create`, `get`, `update`, `delete`, `link`, `reindex`) into that verb's chain of nodes.

## How it works

Notes are Markdown files with YAML frontmatter under `notes/` — the version-controlled source of truth, editable by hand or in any Markdown editor (Obsidian, HelixNotes, etc.). `.azk/azk.db` is a derived, gitignored SQLite index (full-text search, optional semantic embeddings, and the link graph), fully rebuildable from `notes/` at any time via `azk reindex`.

> [!NOTE]
> `.azk/azk.db` is never read or written directly — everything goes through the CLI, and every subcommand prints a single JSON object or array to stdout.

## Install

The bundled `azk-install` Claude Code skill (`.agents/skills/azk-install`) installs `azk` globally and wires up the agent-side protocol for you. To do it manually:

```bash
deno install --global --force --allow-read --allow-write --allow-net --allow-env --env-file \
  --config deno.json -n azk walks/azk.ts
```

`walks/azk.ts` is the whole command: its `DISPATCH` node reads the verb off the command line and routes into that verb's chain. It's also runnable in place via `deno task azk <verb> ...`.

## Usage

| Command | Description |
|---|---|
| `azk search <query> [limit]` | Full-text (and optionally semantic) search across notes, ranked by relevance. |
| `azk create` | Creates a note from `{title, body, tags?, links?}` read as JSON on stdin. |
| `azk get <id>` | Fetches a note and its links by ID. |
| `azk update <id>` | Partially updates `{title?, body?, tags?}` for a note, read as JSON on stdin. |
| `azk delete <id>` | Deletes a note and its links. |
| `azk link <fromId> <toId> <relation>` | Links two existing notes with a short relation phrase. |
| `azk reindex` | Rebuilds `.azk/azk.db` from `notes/*.md`, printing `{indexed, updated, removed, total}`. |

```bash
echo '{"title":"Retry backoff","body":"Use exponential backoff with jitter for the sync job.","tags":["sync"]}' | azk create
azk search "retry backoff"
azk reindex
```

### Semantic search

Search blends keyword matching (FTS5) with semantic similarity when a local OpenAI-compatible embeddings host is reachable — default `http://localhost:11434/v1` with model `embeddinggemma:latest`. Override either with the `EMBEDDING_HOST` / `EMBEDDING_MODEL` environment variables (a `.env` file works too). With no such host running, search degrades gracefully to keyword-only.

## Architecture

One walk, `walks/azk.ts`, wires every verb into a single state machine over the small, single-purpose nodes in `nodes/`, with shared utilities in `utils/` and the whole graph documented in `specs/azk.md`. `ambler.ts` is the state-machine runner itself, taken from [ambler-ts](https://github.com/argenkiwi/ambler-ts).

Because it's one graph, the shared steps are written once and wired into several chains: `nodes/embed.ts` runs at four positions (`SEARCH_EMBED`, `CREATE_EMBED`, `UPDATE_EMBED`, `REINDEX_EMBED`), and `write-note`, `index-upsert`, `exists-check`, `create-links` and `id-arg` are reused the same way. A node id is a position in the graph; the node file and its tests are the unit of reuse. That also makes the whole thing portable: copy `ambler.ts`, `nodes/`, `utils/` and `walks/azk.ts` into another Ambler TS project and the nodes come with it.

## Development

```bash
deno task test     # run the test suite
deno task check    # type-check walks/, nodes/ and utils/
deno task azk ...  # run the CLI locally, e.g. deno task azk search "query"
```
