# Program Specification

This program updates an existing Zettelkasten note. Notes persist as Markdown files with YAML frontmatter under `notes/<id>.md` (the source of truth); `.azk/azk.db` is a derived SQLite index (FTS5 + optional embeddings) updated alongside the note file.

## Nodes

### Update
- Role — Only node of the program.
- Logic — Updates the specified `title`, `body` (with re-embedding), and `tags` of an existing note by `id`.
- Termination — Prints the update result or returns `onNotFound` and terminates.

## Shared State

- `id`: The target note identifier.
- `title`: The new note title, if changing.
- `body`: The new note body, if changing.
- `tags`: The new note tags, if changing.
- `result`: The update result.
- `error`: Error message if the note is not found.
