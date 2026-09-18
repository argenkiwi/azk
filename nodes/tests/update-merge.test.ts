import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../update-merge.ts";
import { Note } from "../../utils/fs.ts";

const sample: Note = {
  id: "20260706120000",
  title: "Retry backoff",
  tags: ["sync"],
  created: "2026-07-06T12:00:00.000Z",
  updated: "2026-07-06T12:00:00.000Z",
  links: [],
  body: "Use jitter.",
};

const utils: Utils = { now: () => "2026-07-07T09:00:00.000Z" };

Deno.test("azkUpdateMergeNode should merge the supplied fields and re-embed when the body changed", async () => {
  const initialState: State = { note: sample, body: "Use jitter and a cap." };

  const result = await factory({ onMerged: "next" }, utils)(initialState);

  assertEquals(result[0], "next");
  assertEquals(result[1].note, {
    ...sample,
    body: "Use jitter and a cap.",
    updated: "2026-07-07T09:00:00.000Z",
  });
  assertEquals(result[1].textToEmbed, "Use jitter and a cap.");
});

Deno.test("azkUpdateMergeNode should keep existing fields and skip embedding when the body is unchanged", async () => {
  const initialState: State = { note: sample, title: "Backoff" };

  const result = await factory({ onMerged: "next" }, utils)(initialState);

  assertEquals(result[0], "next");
  assertEquals(result[1].note, {
    ...sample,
    title: "Backoff",
    updated: "2026-07-07T09:00:00.000Z",
  });
  assertEquals(result[1].textToEmbed, undefined);
});
