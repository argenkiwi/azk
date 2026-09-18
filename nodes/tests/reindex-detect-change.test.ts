import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../reindex-detect-change.ts";
import { Note } from "../../utils/fs.ts";

const sample: Note = {
  id: "a",
  title: "A",
  tags: [],
  created: "2026-07-06T12:00:00.000Z",
  updated: "2026-07-06T12:00:00.000Z",
  links: [],
  body: "Body",
};

function utils(overrides: Partial<Utils> = {}): Utils {
  return {
    readNote: () => Promise.resolve(sample),
    getAzkMeta: () => null,
    hashContent: () => Promise.resolve("current-hash"),
    ...overrides,
  };
}

Deno.test("azkReindexDetectChangeNode should count a note the index has never seen", async () => {
  const initialState: State = { id: "a", indexed: 0, updated: 0 };

  const result = await factory(
    { onChecked: "next", onMissing: "skip" },
    utils(),
  )(initialState);

  assertEquals(result[0], "next");
  assertEquals(result[1].note, sample);
  assertEquals(result[1].textToEmbed, "Body");
  assertEquals(result[1].indexed, 1);
  assertEquals(result[1].updated, 0);
});

Deno.test("azkReindexDetectChangeNode should count a note whose body changed", async () => {
  const initialState: State = { id: "a", indexed: 0, updated: 0 };

  const result = await factory(
    { onChecked: "next", onMissing: "skip" },
    utils({ getAzkMeta: () => ({ bodyHash: "stale-hash" }) }),
  )(initialState);

  assertEquals(result[0], "next");
  assertEquals(result[1].textToEmbed, "Body");
  assertEquals(result[1].indexed, 0);
  assertEquals(result[1].updated, 1);
});

Deno.test("azkReindexDetectChangeNode should clear the pending embed when the body is unchanged", async () => {
  // Carries a previous iteration's textToEmbed to prove it gets cleared
  // rather than left in place for the next note in the loop.
  const initialState: State = {
    id: "a",
    indexed: 0,
    updated: 0,
    textToEmbed: "previous note's body",
  };

  const result = await factory(
    { onChecked: "next", onMissing: "skip" },
    utils({ getAzkMeta: () => ({ bodyHash: "current-hash" }) }),
  )(initialState);

  assertEquals(result[0], "next");
  assertEquals(result[1].textToEmbed, undefined);
  assertEquals(result[1].indexed, 0);
  assertEquals(result[1].updated, 0);
});

Deno.test("azkReindexDetectChangeNode should transition to onMissing when the file has gone", async () => {
  const initialState: State = { id: "a", indexed: 0, updated: 0 };

  const result = await factory(
    { onChecked: "next", onMissing: "skip" },
    utils({ readNote: () => Promise.resolve(null) }),
  )(initialState);

  assertEquals(result[0], "skip");
  assertEquals(result[1].indexed, 0);
  assertEquals(result[1].updated, 0);
});
