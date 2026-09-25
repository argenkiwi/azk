import { assertEquals } from "@std/assert";
import { factory, Utils } from "../clear-finish.ts";

Deno.test("clearFinishNode should print what clear undid", async () => {
  const printed: string[] = [];
  const utils: Utils = { print: (msg) => printed.push(msg) };

  const result = await factory({ onDone: "done" }, utils)({
    gitignore: "removed",
    hooks: { "post-merge": "removed" },
    index: "deleted",
  });

  assertEquals(result[0], "done");
  assertEquals(printed, [JSON.stringify({
    gitignore: "removed",
    hooks: { "post-merge": "removed" },
    index: "deleted",
  })]);
});
