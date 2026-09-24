import { assertEquals } from "@std/assert";
import { factory } from "../setup-index-check.ts";

const edges = { onMissing: "reindex", onPresent: "finish" } as const;

Deno.test("setupIndexCheckNode should take onMissing when there is no index", async () => {
  const result = await factory(edges, {
    indexExists: () => Promise.resolve(false),
  })({});

  assertEquals(result, ["reindex", {}]);
});

Deno.test("setupIndexCheckNode should take onPresent when an index exists", async () => {
  const result = await factory(edges, {
    indexExists: () => Promise.resolve(true),
  })({});

  assertEquals(result, ["finish", {}]);
});
