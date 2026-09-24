import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../setup-finish.ts";

Deno.test("setupFinishNode should include the reindex counters when it ran", async () => {
  const state: State = {
    gitignore: "added",
    hooks: { "post-checkout": "installed" },
    indexed: 2,
    updated: 0,
    removed: 0,
    total: 2,
  };
  const printed: string[] = [];
  const utils: Utils = { print: (msg) => printed.push(msg) };

  const result = await factory({ onDone: "done" }, utils)(state);

  assertEquals(result[0], "done");
  assertEquals(printed, [JSON.stringify({
    gitignore: "added",
    hooks: { "post-checkout": "installed" },
    reindex: { indexed: 2, updated: 0, removed: 0, total: 2 },
  })]);
});

Deno.test("setupFinishNode should report the reindex skipped when it didn't run", async () => {
  const printed: string[] = [];
  const utils: Utils = { print: (msg) => printed.push(msg) };

  await factory({ onDone: "done" }, utils)({
    gitignore: "present",
    hooks: "skipped",
  });

  assertEquals(printed, [JSON.stringify({
    gitignore: "present",
    hooks: "skipped",
    reindex: "skipped",
  })]);
});
