import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../reindex-prune-orphans.ts";

Deno.test("azkReindexPruneOrphansNode should count the index entries it removed", async () => {
  const initialState: State = { allIds: ["a", "b"] };

  const pruned: string[][] = [];
  const utils: Utils = {
    deleteOrphans: (liveIds) => {
      pruned.push(liveIds);
      return ["gone-1", "gone-2"];
    },
  };

  const result = await factory({ onPruned: "next" }, utils)(initialState);

  assertEquals(result[0], "next");
  assertEquals(pruned, [["a", "b"]]);
  assertEquals(result[1].removed, 2);
});
