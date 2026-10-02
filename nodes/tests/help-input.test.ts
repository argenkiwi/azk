import { assert, assertEquals } from "@std/assert";
import { factory, State } from "../help-input.ts";

Deno.test("azkHelpInputNode should resolve the general guide when no verb is given", async () => {
  const initialState: State = { args: [] };

  const result = await factory({ onParsed: "next", onUnknown: "usage" })(
    initialState,
  );

  assertEquals(result[0], "next");
  assertEquals(result[1].topic, "general");
  assertEquals(result[1].usage, undefined);
});

Deno.test("azkHelpInputNode should resolve a known verb case-insensitively", async () => {
  const initialState: State = { args: ["SeArCh"] };

  const result = await factory({ onParsed: "next", onUnknown: "usage" })(
    initialState,
  );

  assertEquals(result[0], "next");
  assertEquals(result[1].topic, "search");
});

Deno.test("azkHelpInputNode should transition to onUnknown for a verb azk doesn't have", async () => {
  const initialState: State = { args: ["bogus"] };

  const result = await factory({ onParsed: "next", onUnknown: "usage" })(
    initialState,
  );

  assertEquals(result[0], "usage");
  assertEquals(result[1].topic, undefined);
  assert(result[1].usage?.startsWith("Usage: azk help [verb]"));
  assert(result[1].usage?.includes("search"));
});

Deno.test("azkHelpInputNode should not treat inherited object keys as verbs", async () => {
  const initialState: State = { args: ["constructor"] };

  const result = await factory({ onParsed: "next", onUnknown: "usage" })(
    initialState,
  );

  assertEquals(result[0], "usage");
});
