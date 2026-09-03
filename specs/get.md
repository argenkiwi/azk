# Program Specification

This program retrieves a Zettelkasten note. Notes persist as Markdown files with YAML frontmatter under `notes/<id>.md` (the source of truth); `.azk/azk.db` is a derived SQLite index holding the link graph.

## Nodes

### Get
- Role — Only node of the program.
- Logic — Fetches a note record and all its associated links by `id`.
- Termination — Prints the record or returns `onNotFound` and terminates.

## Shared State

- `id`: The target note identifier.
- `result`: The retrieved note plus its links.
- `error`: Error message if the note is not found.
