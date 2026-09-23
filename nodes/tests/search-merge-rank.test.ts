import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../search-merge-rank.ts";
import { RankedAzk } from "../../utils/db.ts";

function ranked(id: string, score: number): RankedAzk {
  return {
    id,
    title: id,
    tags: [],
    created: "2026-07-06T12:00:00.000Z",
    score,
  };
}

Deno.test("azkSearchMergeRankNode should boost keyword hits and surface semantic-only matches", async () => {
  const initialState: State = {
    limit: 5,
    keywordResults: [ranked("a", 2), ranked("b", 1)],
    semanticResults: [ranked("b", 0.9), ranked("c", 0.5)],
  };

  const printed: string[] = [];
  const utils: Utils = { print: (msg) => printed.push(msg) };

  const result = await factory({ onFound: "done", onEmpty: "empty" }, utils)(
    initialState,
  );

  assertEquals(result[0], "done");
  assertEquals(
    JSON.parse(printed[0]).map((r: RankedAzk) => [r.id, r.score]),
    [["a", 2], ["b", 1.9], ["c", 0.5]],
  );
});

Deno.test("azkSearchMergeRankNode should truncate to the requested limit", async () => {
  const initialState: State = {
    limit: 1,
    keywordResults: [ranked("a", 2), ranked("b", 1)],
    semanticResults: [],
  };

  const printed: string[] = [];
  const utils: Utils = { print: (msg) => printed.push(msg) };

  const result = await factory({ onFound: "done", onEmpty: "empty" }, utils)(
    initialState,
  );

  assertEquals(result[0], "done");
  assertEquals(JSON.parse(printed[0]).map((r: RankedAzk) => r.id), ["a"]);
});

Deno.test("azkSearchMergeRankNode should print an empty array when nothing matched", async () => {
  const initialState: State = {
    limit: 5,
    keywordResults: [],
    semanticResults: [],
  };

  const printed: string[] = [];
  const utils: Utils = { print: (msg) => printed.push(msg) };

  const result = await factory({ onFound: "done", onEmpty: "empty" }, utils)(
    initialState,
  );

  assertEquals(result[0], "empty");
  assertEquals(printed, ["[]"]);
});
