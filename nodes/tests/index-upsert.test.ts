import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../index-upsert.ts";
import { Note } from "../../utils/fs.ts";

const sample: Note = {
  id: "20260706120000",
  title: "Test",
  tags: ["a"],
  created: "2026-07-06T12:00:00.000Z",
  updated: "2026-07-06T12:00:00.000Z",
  links: [],
  body: "Body",
};

Deno.test("azkIndexUpsertNode should upsert the note with its body hash and embedding", async () => {
  const initialState: State = { note: sample, embedding: [0.1, 0.2] };

  const upserted: { note: { bodyHash: string }; embedding?: number[] }[] = [];
  const utils: Utils = {
    hashContent: () => Promise.resolve("hash-of-body"),
    upsertAzk: (note, embedding) => upserted.push({ note, embedding }),
    print: () => {},
  };

  const result = await factory({ onIndexed: "next", onError: "failed" }, utils)(
    initialState,
  );

  assertEquals(result[0], "next");
  assertEquals(upserted.length, 1);
  assertEquals(upserted[0].note.bodyHash, "hash-of-body");
  assertEquals(upserted[0].embedding, [0.1, 0.2]);
});

Deno.test("azkIndexUpsertNode should omit the embedding when none was produced", async () => {
  const initialState: State = { note: sample, embedding: null };

  const upserted: { embedding?: number[] }[] = [];
  const utils: Utils = {
    hashContent: () => Promise.resolve("hash-of-body"),
    upsertAzk: (_note, embedding) => upserted.push({ embedding }),
    print: () => {},
  };

  const result = await factory({ onIndexed: "next", onError: "failed" }, utils)(
    initialState,
  );

  assertEquals(result[0], "next");
  assertEquals(upserted[0].embedding, undefined);
});

Deno.test("azkIndexUpsertNode should transition to onError when the upsert fails", async () => {
  const initialState: State = { note: sample, embedding: null };

  const printed: string[] = [];
  const utils: Utils = {
    hashContent: () => Promise.resolve("hash-of-body"),
    upsertAzk: () => {
      throw new Error("database is locked");
    },
    print: (msg) => printed.push(msg),
  };

  const result = await factory({ onIndexed: "next", onError: "failed" }, utils)(
    initialState,
  );

  assertEquals(result[0], "failed");
  assertEquals(result[1].error, "database is locked");
  assertEquals(printed, [JSON.stringify({ error: "database is locked" })]);
});
