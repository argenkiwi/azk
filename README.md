# azk

A Zettelkasten CLI for coding agents. `azk` gives an AI coding assistant a durable, searchable note store so design decisions, constraints, and gotchas compound across sessions instead of being rediscovered every time.

It's built on [Ambler](https://github.com/argenkiwi/ambler-ts): each verb (`search`, `create`, `get`, `update`, `delete`, `link`, `reindex`, `help`) is its own small state machine, and `cli.ts` dispatches on the verb to run one of them.

## How it works

Notes are Markdown files with YAML frontmatter under `notes/` — the version-controlled source of truth, editable by hand or in any Markdown editor (Obsidian, HelixNotes, etc.). `.azk/azk.db` is a derived, gitignored SQLite index (full-text search, optional semantic embeddings, and the link graph), fully rebuildable from `notes/` at any time via `azk reindex`.

> [!NOTE]
> `.azk/azk.db` is never read or written directly — everything goes through the CLI, and every subcommand except `help` prints a single JSON object or array to stdout.

---

## Installation & Setup

### 1. Install the CLI Globally

Prerequisites: [Deno](https://deno.land/) installed and `~/.deno/bin` (or your platform's Deno bin directory) added to your `PATH`.

From within your local clone of this repository, run:

```bash
deno install --global --force --allow-read --allow-write --allow-net --allow-env --env-file \
  --config deno.json -n azk cli.ts
```

> [!TIP]
> - `--force` allows overwriting on upgrades. Re-run this command whenever you pull changes to `azk`.
> - `cli.ts` acts as a lazy dispatcher, importing only the Ambler walk required for the executed verb.

### 2. Configure Your Coding Agent

Add the **Zettelkasten RAG Protocol** to your agent's global instruction file (e.g. `~/.claude/CLAUDE.md`, `~/.gemini/config/AGENTS.md`, or your agent's system prompt / global rules). It's deliberately short — it's loaded into every session, so it holds only the protocol and leaves each verb's syntax, output shape and gotchas to `azk help`:

```markdown
# Zettelkasten RAG Protocol

This workspace keeps an `azk` Zettelkasten: atomic, explicitly-linked notes in `notes/` (Markdown, the version-controlled source of truth) indexed into `.azk/azk.db` (derived and gitignored — never read or write it directly). It lets decisions and gotchas compound across sessions instead of being rediscovered. Run `azk help` for the verbs and output conventions, and `azk help <verb>` before first using a verb, for its exact syntax, output shape and gotchas.

**Before non-trivial work** — design decisions, cross-module coupling, workarounds for known bugs or quirks; skip mechanical changes — run `azk search "<task summary>"`, then `azk get` only the 1-3 hits that look relevant. Treat them as prior art; if you disagree with one, say so and update it.

**After the work**, `azk create` one note per non-obvious decision, constraint or gotcha (roughly 3-6 sentences, linked to related notes) — never a restatement of the diff. If search surfaced a note on the same narrow topic, `azk update` it instead; if a note proves stale or wrong, update or delete it rather than leaving a contradiction beside it.

**If the index is missing** (fresh clone) **or you hand-edited `notes/`**, run `azk reindex`. Make sure `.azk/` is gitignored in the project.
```

### 3. Enable azk in Any Project

azk needs no init — `notes/` and `.azk/` are created on first use. To wire a project up properly (a coding agent can follow these steps):

1. Add `.azk/` to the project's `.gitignore`. The index is a derived binary and shouldn't be committed.
2. Run `azk reindex` to build the index from any existing `notes/`.
3. Optional — keep the index in step after checkouts, merges and rebases by adding this line to the `post-checkout`, `post-merge` and `post-rewrite` hooks in the directory `git rev-parse --git-path hooks` prints (which honours `core.hooksPath`, e.g. husky):

   ```sh
   command -v azk >/dev/null 2>&1 && azk reindex >/dev/null 2>&1 || true
   ```

   In `post-checkout`, prefix it with `[ "$3" = "1" ] && ` so file checkouts are skipped. If a hook already exists, insert the line right after its shebang rather than at the end, since a trailing `exit` would skip it, and leave hooks written in non-shell languages alone. The `|| true` means a missing or failing `azk` never blocks git.

To undo: remove those lines and delete `.azk/`. Keep `notes/` — it's the source of truth.

---

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
| `azk help [verb]` | Prints usage guidelines as plain text — general ones, or a verb's syntax, exact output shape and gotchas. Lets an agent learn azk from azk itself. |

```bash
echo '{"title":"Retry backoff","body":"Use exponential backoff with jitter for the sync job.","tags":["sync"]}' | azk create
azk search "retry backoff"
azk reindex
```

### Semantic search

Search blends keyword matching (FTS5) with semantic similarity when a local OpenAI-compatible embeddings host is reachable — default `http://localhost:11434/v1` with model `embeddinggemma:latest`. Override either with the `EMBEDDING_HOST` / `EMBEDDING_MODEL` environment variables (a `.env` file works too). With no such host running, search degrades gracefully to keyword-only.

## Architecture

Eight walks in `walks/`, one per verb, each wiring the small single-purpose nodes in `nodes/` into its own state machine. Shared utilities live in `utils/`, each walk is documented in `specs/<verb>.md`, and `ambler.ts` is the state-machine runner itself, taken from [ambler-ts](https://github.com/argenkiwi/ambler-ts). `cli.ts` is a plain dispatcher rather than a walk — picking a module isn't a state transition, and an Ambler edge can only name a node inside its own walk — so it has no spec.

The unit of reuse is the node file, not the graph position: `nodes/embed.ts` is wired into four walks, and `write-note`, `index-upsert`, `exists-check`, `create-links` and `usage` the same way, each keeping one implementation and one test file. Splitting per verb is what lets a walk's `State` name only the fields that verb touches and mark the ones it seeds required — under a single shared state, every per-verb field had to be optional. It also keeps the whole thing portable: copy `ambler.ts`, `nodes/`, `utils/` and any one walk into another Ambler TS project and only that walk's nodes come with it.

## Development

```bash
deno task test     # run the test suite
deno task check    # type-check walks/, nodes/ and utils/
deno task azk ...  # run the CLI locally, e.g. deno task azk search "query"
```
