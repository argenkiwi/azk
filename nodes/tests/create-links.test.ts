import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../create-links.ts";

Deno.test("azkCreateLinksNode should create every requested link", async () => {
  const initialState: State = {
    fromId: "from-id",
    links: [
      { toId: "to-a", relation: "relates to" },
      { toId: "to-b", relation: "supersedes" },
    ],
  };

  const created: string[][] = [];
  const utils: Utils = {
    createLink: (fromId, toId, relation) =>
      created.push([fromId, toId, relation]),
    print: () => {},
  };

  const result = await factory({ onDone: "next", onError: "failed" }, utils)(
    initialState,
  );

  assertEquals(result[0], "next");
  assertEquals(created, [
    ["from-id", "to-a", "relates to"],
    ["from-id", "to-b", "supersedes"],
  ]);
});

Deno.test("azkCreateLinksNode should do nothing when there are no links", async () => {
  const initialState: State = { fromId: "from-id" };

  const created: string[][] = [];
  const utils: Utils = {
    createLink: (fromId, toId, relation) =>
      created.push([fromId, toId, relation]),
    print: () => {},
  };

  const result = await factory({ onDone: "next", onError: "failed" }, utils)(
    initialState,
  );

  assertEquals(result[0], "next");
  assertEquals(created, []);
});

Deno.test("azkCreateLinksNode should transition to onError when a link cannot be created", async () => {
  const initialState: State = {
    fromId: "from-id",
    links: [{ toId: "to-a", relation: "relates to" }],
  };

  const printed: string[] = [];
  const utils: Utils = {
    createLink: () => {
      throw new Error("database is locked");
    },
    print: (msg) => printed.push(msg),
  };

  const result = await factory({ onDone: "next", onError: "failed" }, utils)(
    initialState,
  );

  assertEquals(result[0], "failed");
  assertEquals(result[1].error, "database is locked");
  assertEquals(printed, [JSON.stringify({ error: "database is locked" })]);
});
