import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../create-finish.ts";
import { Note } from "../../utils/fs.ts";

const sample: Note = {
  id: "20260706120000",
  title: "Retry backoff",
  tags: ["sync"],
  created: "2026-07-06T12:00:00.000Z",
  updated: "2026-07-06T12:00:00.000Z",
  links: [{ to: "other", relation: "relates to" }],
  body: "Use jitter.",
};

Deno.test("azkCreateFinishNode should print the created record", async () => {
  const initialState: State = {
    note: sample,
    links: [{ toId: "other", relation: "relates to" }],
  };

  const printed: string[] = [];
  const utils: Utils = { print: (msg) => printed.push(msg) };

  const result = await factory({ onCreated: "done" }, utils)(initialState);

  assertEquals(result[0], "done");
  assertEquals(printed, [
    JSON.stringify({
      id: "20260706120000",
      title: "Retry backoff",
      tags: ["sync"],
      created: "2026-07-06T12:00:00.000Z",
      links: [{ toId: "other", relation: "relates to" }],
    }),
  ]);
});
