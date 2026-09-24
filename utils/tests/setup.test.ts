import { assertEquals } from "@std/assert";
import {
  addAzkIgnore,
  addHookBlock,
  hasAzkIgnore,
  hasHookBlock,
  hookBlock,
  IGNORE_COMMENT,
  isShellHook,
  removeAzkIgnore,
  removeHookBlock,
} from "../setup.ts";

Deno.test("hasAzkIgnore should accept every root-level spelling of .azk", () => {
  for (const line of [".azk", ".azk/", "/.azk", "/.azk/", "  .azk/  "]) {
    assertEquals(hasAzkIgnore(`node_modules/\n${line}\n`), true, line);
  }
  assertEquals(hasAzkIgnore("node_modules/\n.azkrc\nsrc/.azk\n"), false);
});

Deno.test("addAzkIgnore then removeAzkIgnore should restore the original", () => {
  const original = "node_modules/\n.env\n";
  const added = addAzkIgnore(original);
  assertEquals(added, `node_modules/\n.env\n${IGNORE_COMMENT}\n.azk/\n`);
  assertEquals(hasAzkIgnore(added), true);
  assertEquals(removeAzkIgnore(added), original);
});

Deno.test("addAzkIgnore should add a missing trailing newline and handle an empty file", () => {
  assertEquals(addAzkIgnore("dist"), `dist\n${IGNORE_COMMENT}\n.azk/\n`);
  assertEquals(addAzkIgnore(""), `${IGNORE_COMMENT}\n.azk/\n`);
});

Deno.test("removeAzkIgnore should drop hand-written rules but keep unrelated comments", () => {
  const content = "# --- Azk ---\n/.azk\ndist/\n";
  assertEquals(removeAzkIgnore(content), "# --- Azk ---\ndist/\n");
});

Deno.test("addHookBlock should write a fresh sh script when there is no hook", () => {
  const hook = addHookBlock("post-merge", null);
  assertEquals(hook, `#!/bin/sh\n${hookBlock("post-merge")}`);
  assertEquals(hasHookBlock(hook), true);
  assertEquals(removeHookBlock(hook), null);
});

Deno.test("hookBlock should only guard post-checkout on a branch checkout", () => {
  assertEquals(hookBlock("post-checkout").includes('[ "$3" = "1" ]'), true);
  assertEquals(hookBlock("post-rewrite").includes('"$3"'), false);
});

Deno.test("addHookBlock should splice in after the shebang and round-trip", () => {
  const original = "#!/bin/bash\nset -e\nnpm install\nexit 0\n";
  const added = addHookBlock("post-merge", original);
  assertEquals(added.startsWith(`#!/bin/bash\n${hookBlock("post-merge")}`), true);
  assertEquals(added.endsWith("set -e\nnpm install\nexit 0\n"), true);
  assertEquals(removeHookBlock(added), original);
});

Deno.test("isShellHook should reject non-shell interpreters", () => {
  assertEquals(isShellHook("#!/bin/sh\n"), true);
  assertEquals(isShellHook("#!/usr/bin/env bash\n"), true);
  assertEquals(isShellHook(""), true);
  assertEquals(isShellHook("#!/usr/bin/env node\n"), false);
  assertEquals(isShellHook("#!/usr/bin/env python3\n"), false);
  assertEquals(isShellHook("echo no shebang\n"), false);
});
