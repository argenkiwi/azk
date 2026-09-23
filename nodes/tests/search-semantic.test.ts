import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../search-semantic.ts";
import { AzkMeta } from "../../utils/db.ts";

function meta(id: string): AzkMeta {
  return {
    id,
    title: id,
    tags: [],
    created: "2026-07-06T12:00:00.000Z",
    updated: "2026-07-06T12:00:00.000Z",
    bodyHash: "hash",
    hasEmbedding: true,
  };
}

Deno.test("azkSearchSemanticNode should score the closest notes by cosine similarity", async () => {
  const initialState: State = { limit: 2, embedding: [1, 0] };

  const utils: Utils = {
    getAllEmbeddings: () => [
      { id: "far", vector: [0, 1] },
      { id: "near", vector: [1, 0] },
      { id: "mid", vector: [1, 1] },
    ],
    getAzkMeta: (id) => meta(id),
  };

  const result = await factory({ onScored: "next" }, utils)(initialState);

  assertEquals(result[0], "next");
  assertEquals(result[1].semanticResults?.map((r) => r.id), ["near", "mid"]);
});

Deno.test("azkSearchSemanticNode should score nothing when the query could not be embedded", async () => {
  const initialState: State = { limit: 2, embedding: null };

  let called = false;
  const utils: Utils = {
    getAllEmbeddings: () => {
      called = true;
      return [];
    },
    getAzkMeta: (id) => meta(id),
  };

  const result = await factory({ onScored: "next" }, utils)(initialState);

  assertEquals(result[0], "next");
  assertEquals(result[1].semanticResults, []);
  assertEquals(called, false);
});

Deno.test("azkSearchSemanticNode should skip ids the index no longer has metadata for", async () => {
  const initialState: State = { limit: 2, embedding: [1, 0] };

  const utils: Utils = {
    getAllEmbeddings: () => [{ id: "orphan", vector: [1, 0] }],
    getAzkMeta: () => null,
  };

  const result = await factory({ onScored: "next" }, utils)(initialState);

  assertEquals(result[0], "next");
  assertEquals(result[1].semanticResults, []);
});
