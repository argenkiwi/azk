# Program Specification

This program links two existing Zettelkasten notes. Notes persist as Markdown files with YAML frontmatter under `notes/<id>.md` (the source of truth); `.azk/azk.db` mirrors the link graph derived from each note's frontmatter.

## Nodes

### Link
- Role — Only node of the program.
- Logic — Creates a link between two existing notes (`fromId` and `toId`) with a short `relation` phrase, appending it to the source note's frontmatter and mirroring it into the index.
- Termination — Prints the linkage result or returns `onError` and terminates.

## Shared State

- `fromId`: The source note ID for the link.
- `toId`: The destination note ID for the link.
- `relation`: The connection phrase for the link.
- `result`: The linkage result.
- `error`: Error message if either note does not exist.
