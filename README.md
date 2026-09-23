# azk

A Zettelkasten CLI for coding agents. `azk` gives an AI coding assistant a durable, searchable note store so design decisions, constraints, and gotchas compound across sessions instead of being rediscovered every time.

It's built on [Ambler](https://github.com/argenkiwi/ambler-ts): each verb (`search`, `create`, `get`, `update`, `delete`, `link`, `reindex`) is its own small state machine, and `cli.ts` dispatches on the verb to run one of them.

## How it works

Notes are Markdown files with YAML frontmatter under `notes/` — the version-controlled source of truth, editable by hand or in any Markdown editor (Obsidian, HelixNotes, etc.). `.azk/azk.db` is a derived, gitignored SQLite index (full-text search, optional semantic embeddings, and the link graph), fully rebuildable from `notes/` at any time via `azk reindex`.

> [!NOTE]
> `.azk/azk.db` is never read or written directly — everything goes through the CLI, and every subcommand prints a single JSON object or array to stdout.

## Install

The bundled `azk-install` Claude Code skill (`.agents/skills/azk-install`) installs `azk` globally and wires up the agent-side protocol for you. To do it manually:

```bash
deno install --global --force --allow-read --allow-write --allow-net --allow-env --env-file \
  --config deno.json -n azk cli.ts
```

`cli.ts` reads the verb off the command line and imports that verb's walk from `walks/` — only the one it needs. It's also runnable in place via `deno task azk <verb> ...`, or one verb at a time via `deno task get <id>`, `deno task search "query"` and so on.

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

Seven walks in `walks/`, one per verb, each wiring the small single-purpose nodes in `nodes/` into its own state machine. Shared utilities live in `utils/`, each walk is documented in `specs/<verb>.md`, and `ambler.ts` is the state-machine runner itself, taken from [ambler-ts](https://github.com/argenkiwi/ambler-ts). `cli.ts` is a plain dispatcher rather than a walk — picking a module isn't a state transition, and an Ambler edge can only name a node inside its own walk — so it has no spec.

The unit of reuse is the node file, not the graph position: `nodes/embed.ts` is wired into four walks, and `write-note`, `index-upsert`, `exists-check`, `create-links` and `usage` the same way, each keeping one implementation and one test file. Splitting per verb is what lets a walk's `State` name only the fields that verb touches and mark the ones it seeds required — under a single shared state, every per-verb field had to be optional. It also keeps the whole thing portable: copy `ambler.ts`, `nodes/`, `utils/` and any one walk into another Ambler TS project and only that walk's nodes come with it.

## Development

```bash
deno task test     # run the test suite
deno task check    # type-check walks/, nodes/ and utils/
deno task azk ...  # run the CLI locally, e.g. deno task azk search "query"
```
