import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../reindex-list.ts";

Deno.test("azkReindexListNode should seed the queue and the counters", async () => {
  const initialState: State = {};

  const utils: Utils = { listNoteIds: () => Promise.resolve(["a", "b"]) };

  const result = await factory({ onListed: "next" }, utils)(initialState);

  assertEquals(result[0], "next");
  assertEquals(result[1].allIds, ["a", "b"]);
  assertEquals(result[1].remainingIds, ["a", "b"]);
  assertEquals(result[1].indexed, 0);
  assertEquals(result[1].updated, 0);
  assertEquals(result[1].total, 2);
});
