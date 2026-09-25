import { HookName } from "./config.ts";

/** The `.gitignore` entry `setup` adds, and the comment it puts above it. */
export const IGNORE_ENTRY = ".azk/";
export const IGNORE_COMMENT = "# azk index (derived; rebuild with `azk reindex`)";

/** Delimiters of the block `setup` owns inside a git hook. */
export const HOOK_BLOCK_START = "# >>> azk >>>";
export const HOOK_BLOCK_END = "# <<< azk <<<";

const SHELL_SHEBANG = /^#!.*\b(sh|bash|zsh|dash|ksh)\b/;

/** Any spelling of an ignore rule for `.azk` at the repo root. */
function isAzkIgnoreLine(line: string): boolean {
  return /^\/?\.azk\/?$/.test(line.trim());
}

/**
 * Whether `.gitignore` content already ignores `.azk`, however it was
 * spelled — a hand-written `.azk` or `/.azk/` counts as much as `setup`'s own.
 */
export function hasAzkIgnore(content: string): boolean {
  return content.split("\n").some(isAzkIgnoreLine);
}

/** Appends the ignore entry, under its comment, to `.gitignore` content. */
export function addAzkIgnore(content: string): string {
  const prefix = content === "" || content.endsWith("\n")
    ? content
    : `${content}\n`;
  return `${prefix}${IGNORE_COMMENT}\n${IGNORE_ENTRY}\n`;
}

/**
 * Drops every `.azk` ignore rule from `.gitignore` content, along with
 * `setup`'s comment where it sits directly above one. Any other comment is
 * left alone, since `clear` can't know whether the user wrote it for azk.
 */
export function removeAzkIgnore(content: string): string {
  const kept: string[] = [];
  for (const line of content.split("\n")) {
    if (!isAzkIgnoreLine(line)) {
      kept.push(line);
    } else if (kept.at(-1) === IGNORE_COMMENT) {
      kept.pop();
    }
  }
  return kept.join("\n");
}

/**
 * The shell snippet that keeps the index in step after `hook` fires. It never
 * fails the git operation: a missing `azk` binary or a failed reindex is
 * swallowed, since a stale index is recoverable and a blocked checkout isn't.
 */
export function hookBlock(hook: HookName): string {
  // post-checkout's third argument is 1 for a branch checkout and 0 for a
  // file checkout, which can't change which notes exist.
  const guard = hook === "post-checkout" ? '[ "$3" = "1" ] && ' : "";
  return [
    HOOK_BLOCK_START,
    "# Rebuild the azk index: notes/ may have changed under it.",
    `${guard}command -v azk >/dev/null 2>&1 && azk reindex >/dev/null 2>&1 || true`,
    HOOK_BLOCK_END,
  ].join("\n") + "\n";
}

export function hasHookBlock(content: string): boolean {
  return content.includes(HOOK_BLOCK_START);
}

/**
 * Whether an existing hook is a shell script `setup` can splice its block
 * into. A blank file counts, since there is nothing in it to break.
 */
export function isShellHook(content: string): boolean {
  return content.trim() === "" || SHELL_SHEBANG.test(content);
}

/**
 * Splices the hook's block in right after the shebang, or writes a fresh
 * script around it when there is no hook yet. Going first rather than last
 * means an existing hook ending in `exit` can't skip the reindex, and since
 * the block always succeeds, it can't stop the rest of the hook running.
 *
 * @param content - The existing hook, or `null` if there is none. Must pass
 * {@link isShellHook}.
 */
export function addHookBlock(hook: HookName, content: string | null): string {
  if (content === null || content.trim() === "") {
    return `#!/bin/sh\n${hookBlock(hook)}`;
  }
  const newline = content.indexOf("\n");
  if (newline === -1) return `${content}\n${hookBlock(hook)}`;
  return content.slice(0, newline + 1) + hookBlock(hook) +
    content.slice(newline + 1);
}

/**
 * Cuts `setup`'s block back out of a hook.
 *
 * @returns What's left, or `null` when that's nothing but a shebang — the
 * hook existed only for azk and should be deleted.
 */
export function removeHookBlock(content: string): string | null {
  const lines = content.split("\n");
  const start = lines.indexOf(HOOK_BLOCK_START);
  if (start === -1) return content;
  const end = lines.indexOf(HOOK_BLOCK_END, start);
  lines.splice(start, (end === -1 ? lines.length : end + 1) - start);

  const rest = lines.join("\n");
  const meaningful = lines.filter((line) =>
    line.trim() !== "" && !line.startsWith("#!")
  );
  return meaningful.length === 0 ? null : rest;
}
