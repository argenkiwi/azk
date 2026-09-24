# azk

A Zettelkasten CLI for coding agents. `azk` gives an AI coding assistant a durable, searchable note store so design decisions, constraints, and gotchas compound across sessions instead of being rediscovered every time.

It's built on [Ambler](https://github.com/argenkiwi/ambler-ts): each verb (`search`, `create`, `get`, `update`, `delete`, `link`, `reindex`, `setup`, `clear`, `help`) is its own small state machine, and `cli.ts` dispatches on the verb to run one of them.

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
deno install --global --force --allow-read --allow-write --allow-net --allow-env --allow-run=git --env-file \
  --config deno.json -n azk cli.ts
```

> [!TIP]
> - `--force` allows overwriting on upgrades. Re-run this command whenever you pull changes to `azk`.
> - `--allow-run=git` is only required by `azk setup` and `azk clear` to manage repository git hooks.
> - `cli.ts` acts as a lazy dispatcher, importing only the Ambler walk required for the executed verb.

### 2. Configure Your Coding Agent

Add the **Zettelkasten RAG Protocol** to your agent's global instruction file (e.g. `~/.claude/CLAUDE.md`, `~/.gemini/config/AGENTS.md`, or your agent's system prompt / global rules):

```markdown
# Zettelkasten RAG Protocol

This workspace has a Zettelkasten — an atomic, explicitly-linked note store. Notes are Markdown files with YAML frontmatter under `notes/` (the version-controlled source of truth, editable in Obsidian/HelixNotes or by hand); `.azk/azk.db` is a derived, gitignored SQLite index (full-text search, optional semantic embeddings, and the link graph) rebuildable from `notes/` at any time. It exists so design decisions and gotchas compound across sessions instead of being re-discovered every time. Use it via the global `azk` command below; do not read or write `.azk/azk.db` directly. If you ever hand-edit a file under `notes/`, run `azk reindex` afterward so the index reflects it.

**Before implementing any non-trivial prompt:**

\`\`\`bash
azk search "<short summary of the task>"
\`\`\`

Read the returned notes before writing code. If a note is directly relevant, treat it as prior art — don't rediscover a decision that's already been made (or, if you disagree with it, say so and update it).

**After completing the work:**

\`\`\`bash
echo '{"title":"<short title>","body":"<what you decided or learned, and why>","tags":["<tag>"],"links":[{"toId":"<id>","relation":"<short phrase>"}]}' | azk create
\`\`\`

Capture the *non-obvious* part — a decision, a constraint, a gotcha — not a restatement of the diff. One idea per note. If it builds on or contradicts a note found during search, include it in `links` with a short relation phrase (e.g. "builds on", "supersedes").

**When existing guidance turns out stale or wrong:**

\`\`\`bash
echo '{"title":"..."}' | azk update <id>   # partial {title?,body?,tags?} via stdin
azk delete <id>
\`\`\`

Prefer updating over leaving a contradicting note next to the old one.

**To connect two existing notes explicitly** (the deliberate-linking step, independent of creation-time links):

\`\`\`bash
azk link <fromId> <toId> "<relation phrase>"
\`\`\`

**To fetch one note and its links:**

\`\`\`bash
azk get <id>
\`\`\`

**After a fresh clone, or if the index ever drifts from the Markdown files:**

\`\`\`bash
azk reindex
\`\`\`

The index is gitignored, so a fresh checkout starts with none — run this once before the first `search`. It's always safe to delete `.azk/` and rebuild it this way.

**To wire a project up once** (gitignore `.azk/`, install git hooks that reindex after checkout/merge/rewrite, and build the index if missing) — and to undo it:

\`\`\`bash
azk setup
azk clear   # never touches notes/
\`\`\`

All subcommands except `help` print a single JSON object/array to stdout — parse it directly. Search blends keyword (FTS5) and, when a local OpenAI-compatible embeddings host is reachable (default `http://localhost:11434/v1`, model `embeddinggemma:latest` — override either via the `EMBEDDING_HOST`/`EMBEDDING_MODEL` env vars, e.g. in a `.env` file), semantic similarity — it degrades gracefully to keyword-only if no such host is running.

For the exact JSON shape of each subcommand's output and edge-case gotchas (stdin must be valid JSON, partial-update semantics, delete cascades to links), run `azk help <verb>` (or `azk help` for general usage) — azk documents itself.
```

### 3. Install the Agent Reference Skill (Optional)

You can copy the bundled `azk-reference` skill directory to your agent's global skills directory (e.g. `~/.claude/skills/azk-reference` or `~/.gemini/config/skills/azk-reference`):

```bash
cp -R .agents/skills/azk-reference <your-agent-skills-directory>/azk-reference
```

This teaches your agent how to use `azk help [verb]` to look up exact JSON schemas and edge cases.

### 4. Enable azk in Any Project

In any project repository where you want to use azk:

```bash
azk setup
```

This adds `.azk/` to `.gitignore`, installs `post-checkout`, `post-merge`, and `post-rewrite` hooks that automatically run `azk reindex`, and creates the initial index.

To remove azk configuration and hooks without touching `notes/`:

```bash
azk clear
```

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
| `azk setup` | Makes the current project azk-ready: gitignores `.azk/`, installs `post-checkout`/`post-merge`/`post-rewrite` git hooks that run `azk reindex`, and builds the index if there is none. Safe to re-run. |
| `azk clear` | Undoes `setup`: removes the `.azk` gitignore rule and azk's block from the git hooks, and deletes `.azk/`. Never touches `notes/`. |
| `azk help [verb]` | Prints usage guidelines as plain text — general ones, or a verb's syntax, exact output shape and gotchas. Lets an agent learn azk from azk itself. |

```bash
azk setup
echo '{"title":"Retry backoff","body":"Use exponential backoff with jitter for the sync job.","tags":["sync"]}' | azk create
azk search "retry backoff"
azk reindex
```

### Semantic search

Search blends keyword matching (FTS5) with semantic similarity when a local OpenAI-compatible embeddings host is reachable — default `http://localhost:11434/v1` with model `embeddinggemma:latest`. Override either with the `EMBEDDING_HOST` / `EMBEDDING_MODEL` environment variables (a `.env` file works too). With no such host running, search degrades gracefully to keyword-only.

## Architecture

Nine walks in `walks/`, one per verb, each wiring the small single-purpose nodes in `nodes/` into its own state machine. Shared utilities live in `utils/`, each walk is documented in `specs/<verb>.md`, and `ambler.ts` is the state-machine runner itself, taken from [ambler-ts](https://github.com/argenkiwi/ambler-ts). `cli.ts` is a plain dispatcher rather than a walk — picking a module isn't a state transition, and an Ambler edge can only name a node inside its own walk — so it has no spec.

The unit of reuse is the node file, not the graph position: `nodes/embed.ts` is wired into five walks, `setup` reuses the whole reindex chain, and `write-note`, `index-upsert`, `exists-check`, `create-links` and `usage` the same way, each keeping one implementation and one test file. Splitting per verb is what lets a walk's `State` name only the fields that verb touches and mark the ones it seeds required — under a single shared state, every per-verb field had to be optional. It also keeps the whole thing portable: copy `ambler.ts`, `nodes/`, `utils/` and any one walk into another Ambler TS project and only that walk's nodes come with it.

## Development

```bash
deno task test     # run the test suite
deno task check    # type-check walks/, nodes/ and utils/
deno task azk ...  # run the CLI locally, e.g. deno task azk search "query"
```
