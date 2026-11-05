# azk

A Zettelkasten CLI for coding agents. `azk` gives an AI coding assistant a durable, searchable note store so design decisions, constraints, and gotchas compound across sessions instead of being rediscovered every time.

It's written in Rust on the [Ambler](https://github.com/argenkiwi/ambler-rs) architecture. Each verb (`search`, `create`, `get`, `update`, `delete`, `link`, `reindex`, `help`) is its own small state machine (a *walk*), and `src/main.rs` dispatches on the verb to run one of them.

## How it works

Notes are Markdown files with YAML frontmatter under `notes/`. They're the version-controlled source of truth, and you can edit them by hand or in any Markdown editor (Obsidian, HelixNotes, etc.). `.azk/azk.db` is a derived, gitignored SQLite index holding full-text search, optional semantic embeddings, and the link graph. You can rebuild it from `notes/` at any time with `azk reindex`.

> [!NOTE]
> `.azk/azk.db` is never read or written directly. Everything goes through the CLI, and every subcommand except `help` prints a single JSON object or array to stdout.

---

## Installation & Setup

### 1. Install the CLI globally

Prerequisites: [Rust](https://www.rust-lang.org/tools/install) 1.85 or later, with `~/.cargo/bin` on your `PATH` (rustup sets this up). SQLite is bundled, so you don't need a system copy.

From within your local clone of this repository, run:

```bash
cargo install --path .
```

> [!TIP]
> Re-run this command whenever you pull changes to `azk`. If the version number hasn't changed, add `--force` to reinstall anyway.

#### Upgrading from the Deno build

The Rust build uses a different index schema and a different default embedding model. In each project that already has an index, rebuild it once:

```bash
rm -rf .azk && azk reindex
```

`notes/` is untouched: the note format is the same. You can remove the old binary with `rm ~/.deno/bin/azk`.

### 2. Configure your coding agent

Add the **Zettelkasten RAG Protocol** to your agent's global instruction file (e.g. `~/.claude/CLAUDE.md`, `~/.gemini/config/AGENTS.md`, or your agent's system prompt or global rules). It's deliberately short: it's loaded into every session, so it holds only the protocol and leaves each verb's syntax, output shape and gotchas to `azk help`.

```markdown
# Zettelkasten RAG Protocol

This workspace keeps an `azk` Zettelkasten: atomic, explicitly-linked notes in `notes/` (Markdown, the version-controlled source of truth) indexed into `.azk/azk.db` (derived and gitignored — never read or write it directly). It lets decisions and gotchas compound across sessions instead of being rediscovered. Run `azk help` for the verbs and output conventions, and `azk help <verb>` before first using a verb, for its exact syntax, output shape and gotchas.

**Before non-trivial work** — design decisions, cross-module coupling, workarounds for known bugs or quirks; skip mechanical changes — run `azk search "<task summary>"`, then `azk get` only the 1-3 hits that look relevant. Treat them as prior art; if you disagree with one, say so and update it.

**After the work**, `azk create` one note per non-obvious decision, constraint or gotcha (roughly 3-6 sentences, linked to related notes) — never a restatement of the diff. If search surfaced a note on the same narrow topic, `azk update` it instead; if a note proves stale or wrong, update or delete it rather than leaving a contradiction beside it.

**If the index is missing** (fresh clone) **or you hand-edited `notes/`**, run `azk reindex`. Make sure `.azk/` is gitignored in the project.
```

### 3. Enable azk in any project

azk needs no init: `notes/` and `.azk/` are created on first use. To wire a project up properly (a coding agent can follow these steps):

1. Add `.azk/` to the project's `.gitignore`. The index is a derived binary and shouldn't be committed.
2. Run `azk reindex` to build the index from any existing `notes/`.
3. Optional: keep the index in step after checkouts, merges and rebases. Run `git rev-parse --git-path hooks` to find the hooks directory (this honours `core.hooksPath`, e.g. husky). Add this line to the `post-checkout`, `post-merge` and `post-rewrite` hooks there:

   ```sh
   command -v azk >/dev/null 2>&1 && azk reindex >/dev/null 2>&1 || true
   ```

   In `post-checkout`, prefix the line with `[ "$3" = "1" ] && ` so file checkouts are skipped. If a hook already exists, insert the line right after its shebang rather than at the end, because a trailing `exit` would skip it. Leave hooks written in non-shell languages alone. The `|| true` means a missing or failing `azk` never blocks git.

To undo: remove those lines and delete `.azk/`. Keep `notes/`, because it's the source of truth.

---

## Usage

| Command | Description |
|---|---|
| `azk search <query> [limit]` | Ranks notes against a query using full-text search, plus semantic search when available. |
| `azk create` | Creates a note from `{title, body, tags?, links?}`, read as JSON on stdin. |
| `azk get <id>` | Fetches a note and its links by ID. |
| `azk update <id>` | Partially updates `{title?, body?, tags?}` for a note, read as JSON on stdin. |
| `azk delete <id>` | Deletes a note and its links. |
| `azk link <fromId> <toId> <relation>` | Links two existing notes with a short relation phrase. |
| `azk reindex` | Rebuilds `.azk/azk.db` from `notes/*.md`, printing `{indexed, updated, removed, total}`. |
| `azk help [verb]` | Prints usage guidelines as plain text: the general guide, or one verb's syntax, exact output shape and gotchas. This lets an agent learn azk from azk itself. |

```bash
echo '{"title":"Retry backoff","body":"Use exponential backoff with jitter for the sync job.","tags":["sync"]}' | azk create
azk search "retry backoff"
azk reindex
```

> [!IMPORTANT]
> The exit code isn't a reliable success signal. A bad invocation exits 1, but a failure inside a verb (a note not found, an index error) prints `{"error": "..."}` and exits 0. Always check the JSON for an `error` key.

### Semantic search

Search blends keyword matching (SQLite FTS5) with semantic similarity when an Ollama-style embeddings host is reachable. azk calls `POST /api/embeddings` on that host. The defaults are host `localhost:11434` (the URL scheme is optional) and model `nomic-embed-text`. To use a different model, run `ollama pull <model>` and set `EMBEDDING_MODEL`. Override the host with `EMBEDDING_HOST`.

Both variables are read from the process environment only: azk does not load a `.env` file. With no host running, search degrades gracefully to keyword-only.

> [!NOTE]
> Vectors from different models aren't comparable. After changing `EMBEDDING_MODEL`, run `rm -rf .azk && azk reindex` so every note is re-embedded.

## Architecture

The crate defines two traits in `src/lib.rs`:

- **`Node<S>`**: a node runs one step against the shared state and returns its own typed `Outcome` enum. It never names its successor.
- **`Walk`**: a walk owns its nodes and turns each outcome into a `Transition::Next(id)` or `Transition::Halt`, using an exhaustive `match`.

Because that `match` has no wildcard arm, an unwired outcome is a compile error rather than a runtime surprise.

| Path | Holds |
|---|---|
| `src/walks/` | One walk per verb, each exporting only `Error` and `run(args)`, with its wiring tests inline. |
| `src/nodes/` | The steps. They're shared across walks via small state traits (`HasId`, `HasNote`, `HasError`, …) that each walk's `State` implements with `impl_has!`. |
| `src/utils/` | Every side effect, behind narrow capability traits (`Out`, `Stdin`, `Clock`, `NoteStore`, `Embedder`, `Index`). `System` implements them for production, and `src/testing.rs`'s `Fake` scripts them for tests. |
| `src/guides/` | The `azk help` text, compiled into the binary. |
| `specs/` | A plain-language spec for each walk. |
| `notes/` | This project's own Zettelkasten. |

The unit of reuse is the node, not the graph position. For example, `embed` is wired into four walks, and so are `write_note`, `index_upsert`, `exists_check`, `create_links` and `usage`: each has one implementation shared by every walk that uses it.

Splitting the walks per verb lets each walk's `State` hold exactly the fields that verb needs. A single routing walk would have had one `State` with every verb's fields optional. `src/main.rs` is therefore a plain dispatcher rather than a walk, because picking a verb is a one-off lookup, not a state transition, so it has no spec.

## Development

```bash
cargo test                                   # node and walk tests
cargo clippy --all-targets -- -D warnings
cargo fmt --check
cargo run -- search "query"                  # run the CLI locally
```

> [!CAUTION]
> `cargo run` reads and writes `notes/` and `.azk/` in the current directory. Run it from a scratch directory unless you mean to change this repo's own notes.

The [`.agents/skills`](.agents/skills) directory holds step-by-step guides for coding agents working on azk:

| Skill | Use it to |
|---|---|
| `ambler-node` | Add a node using TDD |
| `ambler-test` | Add tests to an existing node or walk |
| `ambler-util` | Add a side-effect capability to `src/utils/` |
| `ambler-walk` | Wire nodes into a new verb, with its spec |
| `ambler-spec` | Write a walk's Markdown spec |
