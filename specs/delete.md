# Program Specification

This program deletes a Zettelkasten note. Notes persist as Markdown files with YAML frontmatter under `notes/<id>.md` (the source of truth); `.azk/azk.db` is a derived SQLite index holding the note's metadata and link graph.

## Nodes

### Delete
- Role — Only node of the program.
- Logic — Removes a note record by `id`.
- Termination — Prints the deletion result or returns `onNotFound` and terminates.

## Shared State

- `id`: The target note identifier.
- `result`: The deletion result.
- `error`: Error message if the note is not found.
