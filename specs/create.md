# Program Specification

This program creates a new Zettelkasten note. Notes persist as Markdown files with YAML frontmatter under `notes/<id>.md` (the source of truth); `.azk/azk.db` is a derived SQLite index (FTS5 + optional embeddings) updated alongside the note file.

## Nodes

### Create
- Role — Only node of the program.
- Logic — Generates a unique ID and optional embedding for a new note with `title`, `body`, and `tags`, saves it, and establishes any specified `links`.
- Termination — Prints the created record to stdout and terminates.

## Shared State

- `title`: The note title.
- `body`: The note body content.
- `tags`: The note tags.
- `links`: Optional list of links to create alongside the note.
- `result`: The created note's summary.
- `error`: Error message if the operation fails.
