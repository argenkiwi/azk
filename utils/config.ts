/** Directory (relative to the project root) where note Markdown files live. */
export const NOTES_DIR = "notes";

/** Directory (relative to the project root) holding everything derived and local-only. */
export const AZK_DIR = ".azk";

/** Path (relative to the project root) to the derived SQLite search/link index. */
export const DB_PATH = `${AZK_DIR}/azk.db`;

/** Path (relative to the project root) to the file `setup` keeps `.azk/` out of git with. */
export const GITIGNORE_PATH = ".gitignore";

/**
 * The git hooks `setup` installs a reindex into: every event after which
 * `notes/` may differ from what the index was built from.
 */
export const HOOK_NAMES = ["post-checkout", "post-merge", "post-rewrite"] as const;

export type HookName = typeof HOOK_NAMES[number];

/**
 * Path to a note's Markdown file on disk.
 *
 * @param id - The note's unique id.
 */
export function notePath(id: string): string {
  return `${NOTES_DIR}/${id}.md`;
}
