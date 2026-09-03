# Program Specification

This program searches the Zettelkasten note index. Notes persist as Markdown files with YAML frontmatter under `notes/<id>.md` (the source of truth); `.azk/azk.db` is a derived SQLite index (FTS5 + optional embeddings) kept in sync by the sibling create/update/delete/link/reindex programs.

## Nodes

### Search
- Role — Only node of the program.
- Logic — Performs keyword full-text search and optional semantic similarity ranking for `query`, returning up to `limit` matches.
- Termination — Prints results to stdout and terminates.

## Shared State

- `query`: The search text.
- `limit`: Optional maximum number of results (defaults to 5).
- `results`: List of ranked matches.
- `error`: Error message if the operation fails.
