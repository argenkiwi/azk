# Program Specification

This program rebuilds the Zettelkasten's derived SQLite index from its Markdown source of truth. Notes persist as Markdown files with YAML frontmatter under `notes/<id>.md`; `.azk/azk.db` is a derived, gitignored SQLite index (FTS5 + optional embeddings + link graph), fully rebuildable by this program at any time.

## Nodes

### Reindex
- Role — Only node of the program.
- Logic — Walks every `notes/*.md` file, upserts changed notes into the SQLite index (re-embedding only when a note's body hash changed), rebuilds the link graph from each note's frontmatter, and removes index entries whose file no longer exists.
- Termination — Prints `{ indexed, updated, removed, total }` and terminates.

## Shared State

- `result`: The reindex summary (`{ indexed, updated, removed, total }`).
- `error`: Error message if the operation fails.
