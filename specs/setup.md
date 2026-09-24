# Program Specification

This program is the `setup` verb of the `azk` command line: it makes the project in the current directory azk-ready, and is safe to re-run. Notes persist as Markdown files under `notes/<id>.md` (the source of truth); `.azk/azk.db` is a derived SQLite index that must stay out of git and in step with the notes. `setup` arranges both: it gitignores `.azk/`, installs git hooks that reindex whenever `notes/` may have changed under the index, and builds the index if there is none yet. The `clear` walk undoes it.

Like `reindex`, it takes no arguments, so it has no `USAGE` node and no non-zero exit. It prints a single JSON summary of what each step found or did.

## Nodes

### Gitignore
- Initial node of the program.
- Implemented by `nodes/setup-gitignore.ts`.
- Appends `.azk/` under a recognisable comment, creating `.gitignore` if needed. Any existing root-level rule for `.azk` (`.azk`, `.azk/`, `/.azk`, `/.azk/`) counts as already present.
- Transitions to `HOOKS`.

### Hooks
- Implemented by `nodes/setup-hooks.ts`.
- Resolves the hooks directory through `git rev-parse --git-path hooks`, so linked worktrees and `core.hooksPath` (husky and the like) are honoured. Outside a git repo, or without git, the step is `skipped` rather than failing.
- For each of `post-checkout`, `post-merge` and `post-rewrite` — every event after which `notes/` may differ — splices a delimited block that runs `azk reindex` into the hook, directly after the shebang so an existing hook ending in `exit` can't skip it. A missing hook is created as a `#!/bin/sh` script. A hook already holding the block is `present`; one written in a non-shell language is left untouched and reported `unsupported`.
- The block never fails the git operation: it is a no-op when `azk` is not on `PATH`, swallows a failed reindex, and in `post-checkout` only fires on a branch checkout.
- Transitions to `INDEX_CHECK`.

### Index Check
- Implemented by `nodes/setup-index-check.ts`.
- If `.azk/` does not exist, transitions to `LIST`. Otherwise transitions to `FINISH` — an existing index is kept current by the hooks, so a re-run stays cheap.

### List, Next, Detect Change, Embed, Index Upsert, Replace Links, Prune Orphans
- The reindex chain, reused node for node and wired exactly as in `specs/reindex.md`, except that `PRUNE_ORPHANS` transitions to this walk's `FINISH` rather than the reindex walk's own finish node, so the run prints one JSON value instead of two.

### Finish
- Terminal node of the program.
- Implemented by `nodes/setup-finish.ts`.
- Prints `{ gitignore, hooks, reindex }`, where `reindex` holds the reindex counters if the chain ran and is `"skipped"` otherwise.

## Shared State

Nothing is seeded.

- `gitignore`: `added` or `present`.
- `hooks`: Each hook's status — `installed`, `present` or `unsupported` — or `skipped` outside a git repo.
- `error`, `allIds`, `remainingIds`, `id`, `note`, `textToEmbed`, `embedding`, `indexed`, `updated`, `removed`, `total`: The reindex chain's fields, as described in `specs/reindex.md`. `FINISH` treats a set `total` as the sign that the chain ran.
