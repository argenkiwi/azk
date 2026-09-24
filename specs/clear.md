# Program Specification

This program is the `clear` verb of the `azk` command line: it undoes what `setup` did to the project in the current directory, and is safe to re-run. It never touches `notes/` — the source of truth — only the index derived from it and the project wiring `setup` added around it.

It takes no arguments and has no failure branch, so it is a straight line with no `USAGE` node and no non-zero exit. It prints a single JSON summary.

## Nodes

### Gitignore
- Initial node of the program.
- Implemented by `nodes/clear-gitignore.ts`.
- Removes every root-level `.azk` rule from `.gitignore`, together with `setup`'s own comment where it sits directly above one. Other comments are left alone, since `clear` can't know who wrote them, and the file is kept even if it ends up empty.
- Transitions to `HOOKS`.

### Hooks
- Implemented by `nodes/clear-hooks.ts`.
- Resolves the hooks directory the same way `setup` does, and is `skipped` outside a git repo.
- Cuts `setup`'s delimited block out of each of `post-checkout`, `post-merge` and `post-rewrite`. A hook left holding nothing but a shebang existed only for azk and is deleted; anything else it does is kept, in place and with its mode intact.
- Transitions to `INDEX`.

### Index
- Implemented by `nodes/clear-index.ts`.
- Deletes `.azk/` recursively — always safe, because everything in it is rebuildable from `notes/`.
- Transitions to `FINISH`.

### Finish
- Terminal node of the program.
- Implemented by `nodes/clear-finish.ts`.
- Prints `{ gitignore, hooks, index }`.

## Shared State

Nothing is seeded.

- `gitignore`: `removed` or `absent`.
- `hooks`: Each hook's status — `removed` or `absent` — or `skipped` outside a git repo.
- `index`: `deleted` or `absent`.
