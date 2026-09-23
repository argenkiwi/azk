import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../search-keyword.ts";
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

Deno.test("azkSearchKeywordNode should rank matches best first and queue the query for embedding", async () => {
  const initialState: State = { query: "retry backoff", limit: 5 };

  const utils: Utils = {
    searchAzk: () => [meta("a"), meta("b")],
  };

  const result = await factory({ onSearched: "next" }, utils)(initialState);

  assertEquals(result[0], "next");
  assertEquals(result[1].keywordResults?.map((r) => [r.id, r.score]), [
    ["a", 2],
    ["b", 1],
  ]);
  assertEquals(result[1].textToEmbed, "retry backoff");
});

Deno.test("azkSearchKeywordNode should produce no matches when the index has none", async () => {
  const initialState: State = { query: "retry backoff", limit: 5 };

  const utils: Utils = { searchAzk: () => [] };

  const result = await factory({ onSearched: "next" }, utils)(initialState);

  assertEquals(result[0], "next");
  assertEquals(result[1].keywordResults, []);
});
