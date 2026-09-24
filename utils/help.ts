/**
 * The guides `azk help` prints. They are string constants rather than `.md`
 * files read at runtime so an installed binary needs no read permission on
 * its own source directory.
 */

export const GENERAL = `# azk

A Zettelkasten for coding agents: atomic, explicitly-linked notes that let
design decisions and gotchas compound across sessions instead of being
rediscovered every time.

- \`notes/<id>.md\` — Markdown with YAML frontmatter. The version-controlled
  source of truth; safe to edit by hand or in any Markdown editor.
- \`.azk/azk.db\` — a derived, gitignored SQLite index (full-text search,
  optional semantic embeddings, link graph). Never read or write it directly;
  it is always rebuildable from \`notes/\` with \`azk reindex\`.

## Verbs

  azk search "<query>" [limit]       Rank notes against a query (metadata only)
  azk create                         Create a note from JSON on stdin
  azk get <id>                       Fetch one note, with body and links
  azk update <id>                    Partially update a note from JSON on stdin
  azk delete <id>                    Delete a note and every link touching it
  azk link <fromId> <toId> "<rel>"   Link two existing notes
  azk reindex                        Rebuild the index from notes/
  azk setup                          Make the current project azk-ready
  azk clear                          Undo setup (never touches notes/)
  azk help [verb]                    Print this guide, or one verb's guide

Run \`azk help <verb>\` for that verb's exact output shape and gotchas.

## Output conventions

- Every verb except \`help\` prints a single JSON value to stdout. Usage
  messages go to stderr.
- **Exit code isn't a reliable success signal.** A bad invocation (missing
  argument, malformed JSON on stdin) exits 1. A failure *inside* a verb — a
  note not found, a write or embed failure — prints \`{ "error": "..." }\`
  and still exits 0. Always check the JSON for a top-level \`error\` key.

## Typical workflow

1. Once per project: \`azk setup\` (after a fresh clone, \`azk reindex\` also
   works — the index is gitignored, so a checkout starts without one).
2. Before non-trivial work: \`azk search "<task summary>"\`, then \`azk get\`
   only the 1-3 hits that look relevant. Treat them as prior art.
3. After the work: \`azk create\` one note per non-obvious decision or gotcha —
   not a restatement of the diff. Link it to related notes.
4. When a note turns out stale or wrong: \`azk update\` it (or
   \`azk delete\` it) rather than leaving a contradicting note beside it.
5. After hand-editing anything under \`notes/\`: \`azk reindex\`.

## Semantic search

Search blends keyword (FTS5) ranking with semantic similarity when an
OpenAI-compatible embeddings host is reachable — by default
\`http://localhost:11434/v1\` with model \`embeddinggemma:latest\`. Override
either with the \`EMBEDDING_HOST\` / \`EMBEDDING_MODEL\` environment variables
(a \`.env\` file in the project works). With no host, search degrades to
keyword-only rather than failing.`;

export const VERB_GUIDES: Record<string, string> = {
  search: `# azk search

  azk search "<query>" [limit]

\`limit\` defaults to 5.

Returns \`{ id, title, tags, created, score }[]\`, best match first, or \`[]\`.
No note bodies — \`azk get\` the hits you actually need.

- Blends keyword (FTS5) and semantic ranking; degrades to keyword-only when no
  embeddings host is reachable.
- An empty result is not an error: it prints \`[]\` and exits 0.
- A missing query prints usage to stderr and exits 1.`,

  create: `# azk create

  echo '{"title":"...","body":"...","tags":["..."],"links":[{"toId":"...","relation":"..."}]}' | azk create

\`title\` and \`body\` are required; \`tags\` and \`links\` are optional.

Returns \`{ id, title, tags, created, links }\`, or \`{ error }\` (exit 0) if the
write or embedding fails.

Gotchas:
- Malformed or empty stdin JSON prints \`{ "error": "invalid JSON on stdin" }\`
  and exits 1; a missing \`title\`/\`body\` prints
  \`{ "error": "title and body are required" }\` and exits 1. Stdin problems
  never produce a \`Usage:\` line.
- \`links\` are not validated: a \`toId\` that doesn't exist is stored as a
  dangling link (unlike \`azk link\`, which checks both ids first). \`reindex\`
  won't clean it up either — it trusts each note's frontmatter links.`,

  get: `# azk get

  azk get <id>

Returns the full note (including body) plus every link touching it in either
direction, or \`{ error }\` (exit 0) if the note doesn't exist.

A missing id prints usage to stderr and exits 1.`,

  update: `# azk update

  echo '{"body":"..."}' | azk update <id>

Partial update — any subset of \`title\`, \`body\`, \`tags\`. An empty object
\`{}\` is a valid no-op.

Returns \`{ id, updated: true }\` — not the updated fields themselves.

Gotchas:
- Only re-embeds when \`body\` changes.
- Malformed stdin JSON prints \`{ "error": "invalid JSON on stdin" }\` and exits
  1, as in \`create\`.
- An id that doesn't exist prints \`{ error }\` and exits 0; a missing id
  argument prints usage and exits 1.
- \`links\` can't be changed here — use \`azk link\`.`,

  delete: `# azk delete

  azk delete <id>

Removes the note's file, its index entry, and every link referencing it in
either direction.

Returns \`{ id, deleted: true }\`, or \`{ error }\` (exit 0) if the note doesn't
exist. A missing id argument prints usage and exits 1.`,

  link: `# azk link

  azk link <fromId> <toId> "<relation>"

Links two existing notes with a short relation phrase (e.g. "builds on").

Returns \`{ fromId, toId, relation, linked: true }\`, or \`{ error }\` (exit 0)
if either id doesn't exist. Missing arguments print usage and exit 1.

If the relation you'd write reads like "supersedes" or "fixes X", consider
\`azk update\` on X instead of a new linked note.`,

  reindex: `# azk reindex

  azk reindex

Rebuilds \`.azk/azk.db\` from \`notes/*.md\`. Returns
\`{ indexed, updated, removed, total }\`.

- Re-embeds only notes whose body changed, but re-upserts every note and
  rebuilds its links, so a hand-edit touching only frontmatter links is still
  picked up.
- Drops index entries for notes whose file no longer exists.
- Always safe: \`.azk/\` can be deleted and rebuilt this way at any time.

Gotchas:
- A note whose frontmatter has an *unquoted* ISO timestamp
  (\`created: 2026-09-01T00:00:00.000Z\`) parses as a YAML date, not a string,
  and the index rejects it —
  \`{ "error": "Provided value cannot be bound to SQLite parameter 4." }\` —
  abandoning the rest of the queue. azk always quotes timestamps it writes; a
  hand-written or editor-generated note may not.`,

  setup: `# azk setup

  azk setup

Run from the project root; idempotent. Gitignores \`.azk/\`, installs
\`post-checkout\`/\`post-merge\`/\`post-rewrite\` git hooks that run
\`azk reindex\`, and builds the index if there is none.

Returns:
  {
    gitignore: "added" | "present",
    hooks: { "post-checkout" | "post-merge" | "post-rewrite":
             "installed" | "present" | "unsupported" } | "skipped",
    reindex: { indexed, updated, removed, total } | "skipped"
  }

Gotchas:
- \`reindex\` only runs when \`.azk/\` doesn't exist yet; an existing index is
  left to the hooks.
- \`hooks: "skipped"\` means the cwd isn't in a git repo (or git isn't
  installed). The hooks directory comes from \`git rev-parse --git-path hooks\`,
  so \`core.hooksPath\` (e.g. husky) is honoured.
- An existing hook is spliced into (right after its shebang), not replaced. A
  hook in a non-shell language (\`#!/usr/bin/env node\`, …) is reported
  \`unsupported\` and left untouched — add \`azk reindex\` to it by hand.
- The hook calls the global \`azk\` binary and is a silent no-op if it isn't on
  \`PATH\`; it never fails the git operation.`,

  clear: `# azk clear

  azk clear

Undoes \`setup\`; idempotent. Never touches \`notes/\`.

Returns:
  {
    gitignore: "removed" | "absent",
    hooks: { <hook>: "removed" | "absent" } | "skipped",
    index: "deleted" | "absent"
  }

- Removes every root-level \`.azk\` rule from \`.gitignore\`, not just the one
  \`setup\` wrote.
- Cuts azk's block out of each hook, deleting hooks that held nothing else.
- Deletes \`.azk/\`.`,

  help: `# azk help

  azk help [verb]

With no verb, prints the general guide; with one, prints that verb's guide.
Unlike every other verb, the output is plain Markdown text, not JSON.

An unknown verb prints usage to stderr and exits 1.`,
};
