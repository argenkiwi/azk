import { assertEquals } from "@std/assert";
import { factory, State } from "../link-input.ts";

Deno.test("azkLinkInputNode should read the two ids and the relation", async () => {
  const initialState: State = { args: ["from-id", "to-id", "relates to"] };

  const result = await factory({ onParsed: "next", onMissing: "usage" })(
    initialState,
  );

  assertEquals(result[0], "next");
  assertEquals(result[1].fromId, "from-id");
  assertEquals(result[1].toId, "to-id");
  assertEquals(result[1].relation, "relates to");
});

Deno.test("azkLinkInputNode should transition to onMissing when an argument is absent", async () => {
  const initialState: State = { args: ["from-id", "to-id"] };

  const result = await factory({ onParsed: "next", onMissing: "usage" })(
    initialState,
  );

  assertEquals(result[0], "usage");
  assertEquals(result[1].usage, 'Usage: azk link <fromId> <toId> "<relation>"');
});
