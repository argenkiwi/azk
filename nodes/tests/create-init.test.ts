import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../create-init.ts";

const utils: Utils = {
  generateId: () => "20260706120000",
  now: () => "2026-07-06T12:00:00.000Z",
};

Deno.test("azkCreateInitNode should build the note, its link source and the text to embed", async () => {
  const initialState: State = {
    title: "Retry backoff",
    body: "Use jitter.",
    tags: ["sync"],
    links: [{ toId: "other", relation: "relates to" }],
  };

  const result = await factory({ onReady: "next" }, utils)(initialState);

  assertEquals(result[0], "next");
  assertEquals(result[1].note, {
    id: "20260706120000",
    title: "Retry backoff",
    tags: ["sync"],
    created: "2026-07-06T12:00:00.000Z",
    updated: "2026-07-06T12:00:00.000Z",
    links: [{ to: "other", relation: "relates to" }],
    body: "Use jitter.",
  });
  assertEquals(result[1].fromId, "20260706120000");
  assertEquals(result[1].textToEmbed, "Use jitter.");
});
