# azk

A Zettelkasten CLI for coding agents. `azk` gives an AI coding assistant a durable, searchable note store so design decisions, constraints, and gotchas compound across sessions instead of being rediscovered every time.

It's built from seven independent [Ambler](https://github.com/argenkiwi/ambler-ts) walks (`search`, `create`, `get`, `update`, `delete`, `link`, `reindex`) behind a single `azk` dispatcher.

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

`cli.ts` is a thin dispatcher: it routes `azk <verb> ...` to the matching standalone walk under `walks/`, each of which is also independently runnable via `deno run walks/<verb>.ts` or `deno task <verb>`.

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

Each verb is an independent Ambler walk: a small state machine of `nodes/` wired together in `walks/`, with shared utilities in `utils/` and a program specification in `specs/` describing its nodes and shared state. `ambler.ts` is the state-machine runner itself, taken from [ambler-ts](https://github.com/argenkiwi/ambler-ts).

## Development

```bash
deno task test    # run the test suite
deno task azk ...  # run the dispatcher locally, e.g. deno task azk search "query"
```
