import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../create-input.ts";

function stdin(value: unknown): Utils {
  return { readStdinJson: () => Promise.resolve(value) };
}

Deno.test("azkCreateInputNode should read title, body, tags and links from stdin", async () => {
  const initialState: State = {};

  const result = await factory(
    { onParsed: "next", onInvalid: "usage" },
    stdin({
      title: "Retry backoff",
      body: "Use jitter.",
      tags: ["sync"],
      links: [{ toId: "other", relation: "relates to" }],
    }),
  )(initialState);

  assertEquals(result[0], "next");
  assertEquals(result[1].title, "Retry backoff");
  assertEquals(result[1].body, "Use jitter.");
  assertEquals(result[1].tags, ["sync"]);
  assertEquals(result[1].links, [{ toId: "other", relation: "relates to" }]);
});

Deno.test("azkCreateInputNode should default tags and links when they are omitted", async () => {
  const initialState: State = {};

  const result = await factory(
    { onParsed: "next", onInvalid: "usage" },
    stdin({ title: "Retry backoff", body: "Use jitter." }),
  )(initialState);

  assertEquals(result[0], "next");
  assertEquals(result[1].tags, []);
  assertEquals(result[1].links, []);
});

Deno.test("azkCreateInputNode should transition to onInvalid when title or body is missing", async () => {
  const initialState: State = {};

  const result = await factory(
    { onParsed: "next", onInvalid: "usage" },
    stdin({ title: "Retry backoff" }),
  )(initialState);

  assertEquals(result[0], "usage");
  assertEquals(
    result[1].usage,
    JSON.stringify({ error: "title and body are required" }),
  );
});

Deno.test("azkCreateInputNode should transition to onInvalid when stdin is not valid JSON", async () => {
  const initialState: State = {};

  const result = await factory(
    { onParsed: "next", onInvalid: "usage" },
    { readStdinJson: () => Promise.reject(new SyntaxError("Unexpected end")) },
  )(initialState);

  assertEquals(result[0], "usage");
  assertEquals(
    result[1].usage,
    JSON.stringify({ error: "invalid JSON on stdin" }),
  );
});
