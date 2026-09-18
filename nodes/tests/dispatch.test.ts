import { assertEquals, assertStringIncludes } from "@std/assert";
import { factory, State } from "../dispatch.ts";

const edges = {
  onSearch: "SEARCH",
  onCreate: "CREATE",
  onGet: "GET",
  onUpdate: "UPDATE",
  onDelete: "DELETE",
  onLink: "LINK",
  onReindex: "REINDEX",
  onUnknown: "USAGE",
} as const;

Deno.test("azkDispatchNode should route each verb to its own chain", async () => {
  for (
    const [verb, expected] of Object.entries({
      search: "SEARCH",
      create: "CREATE",
      get: "GET",
      update: "UPDATE",
      delete: "DELETE",
      link: "LINK",
      reindex: "REINDEX",
    })
  ) {
    const initialState: State = { argv: [verb, "rest"] };

    const result = await factory(edges)(initialState);

    assertEquals(result[0], expected);
    assertEquals(result[1].verb, verb);
    assertEquals(result[1].args, ["rest"]);
  }
});

Deno.test("azkDispatchNode should match a verb regardless of case", async () => {
  const initialState: State = { argv: ["GeT", "an-id"] };

  const result = await factory(edges)(initialState);

  assertEquals(result[0], "GET");
  assertEquals(result[1].verb, "get");
});

Deno.test("azkDispatchNode should transition to onUnknown for a verb azk does not have", async () => {
  const initialState: State = { argv: ["bogus"] };

  const result = await factory(edges)(initialState);

  assertEquals(result[0], "USAGE");
  assertStringIncludes(result[1].usage ?? "", "Usage: azk <verb> [args]");
});

Deno.test("azkDispatchNode should transition to onUnknown when no verb was given", async () => {
  const initialState: State = { argv: [] };

  const result = await factory(edges)(initialState);

  assertEquals(result[0], "USAGE");
  assertStringIncludes(result[1].usage ?? "", "Usage: azk <verb> [args]");
});
