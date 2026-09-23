import { assertEquals } from "@std/assert";
import { factory, State } from "../reindex-next.ts";

Deno.test("azkReindexNextNode should pop the next id off the queue", async () => {
  const initialState: State = { remainingIds: ["a", "b"] };

  const result = await factory({ onNext: "next", onDone: "done" })(
    initialState,
  );

  assertEquals(result[0], "next");
  assertEquals(result[1].id, "a");
  assertEquals(result[1].remainingIds, ["b"]);
});

Deno.test("azkReindexNextNode should transition to onDone when the queue is empty", async () => {
  const initialState: State = { remainingIds: [] };

  const result = await factory({ onNext: "next", onDone: "done" })(
    initialState,
  );

  assertEquals(result[0], "done");
});
