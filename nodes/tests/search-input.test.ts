import { assertEquals } from "@std/assert";
import { factory, State } from "../search-input.ts";

Deno.test("azkSearchInputNode should read the query and an explicit limit", async () => {
  const initialState: State = { args: ["retry backoff", "10"] };

  const result = await factory({ onParsed: "next", onMissing: "usage" })(
    initialState,
  );

  assertEquals(result[0], "next");
  assertEquals(result[1].query, "retry backoff");
  assertEquals(result[1].limit, 10);
});

Deno.test("azkSearchInputNode should fall back to the default limit", async () => {
  const initialState: State = { args: ["retry backoff"] };

  const result = await factory({ onParsed: "next", onMissing: "usage" })(
    initialState,
  );

  assertEquals(result[0], "next");
  assertEquals(result[1].limit, 5);
});

Deno.test("azkSearchInputNode should transition to onMissing when no query was given", async () => {
  const initialState: State = { args: [] };

  const result = await factory({ onParsed: "next", onMissing: "usage" })(
    initialState,
  );

  assertEquals(result[0], "usage");
  assertEquals(result[1].usage, 'Usage: azk search "<query>" [limit]');
});
