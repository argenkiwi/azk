import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../reindex-replace-links.ts";
import { Note } from "../../utils/fs.ts";

const sample: Note = {
  id: "a",
  title: "A",
  tags: [],
  created: "2026-07-06T12:00:00.000Z",
  updated: "2026-07-06T12:00:00.000Z",
  links: [{ to: "b", relation: "relates to" }],
  body: "Body",
};

Deno.test("azkReindexReplaceLinksNode should rebuild the note's links from its frontmatter", async () => {
  const initialState: State = { id: "a", note: sample };

  const replaced: { fromId: string; links: unknown }[] = [];
  const utils: Utils = {
    replaceLinksForNote: (fromId, links) => replaced.push({ fromId, links }),
  };

  const result = await factory({ onReplaced: "next" }, utils)(initialState);

  assertEquals(result[0], "next");
  assertEquals(replaced, [{
    fromId: "a",
    links: [{ to: "b", relation: "relates to" }],
  }]);
});
