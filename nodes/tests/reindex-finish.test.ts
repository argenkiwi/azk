import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../reindex-finish.ts";

Deno.test("azkReindexFinishNode should print the reindex summary", async () => {
  const initialState: State = {
    indexed: 1,
    updated: 2,
    removed: 3,
    total: 6,
  };

  const printed: string[] = [];
  const utils: Utils = { print: (msg) => printed.push(msg) };

  const result = await factory({ onIndexed: "done" }, utils)(initialState);

  assertEquals(result[0], "done");
  assertEquals(printed, [
    JSON.stringify({ indexed: 1, updated: 2, removed: 3, total: 6 }),
  ]);
});
