import { assertEquals } from "@std/assert";
import { factory, State } from "../clear-index.ts";

Deno.test("clearIndexNode should report deleted when there was an index", async () => {
  const result = await factory({ onDone: "done" }, {
    deleteIndex: () => Promise.resolve(true),
  })({} as State);

  assertEquals(result, ["done", { index: "deleted" }]);
});

Deno.test("clearIndexNode should report absent when there was none", async () => {
  const result = await factory({ onDone: "done" }, {
    deleteIndex: () => Promise.resolve(false),
  })({} as State);

  assertEquals(result, ["done", { index: "absent" }]);
});
