import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../get.ts";
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

Deno.test("azkGetNode should print the note together with every link touching it", async () => {
  const initialState: State = { id: sample.id, note: sample };

  const printed: string[] = [];
  const utils: Utils = {
    getLinks: () => [{
      fromId: sample.id,
      toId: "other",
      relation: "relates to",
    }],
    print: (msg) => printed.push(msg),
  };

  const result = await factory({ onFound: "done" }, utils)(initialState);

  assertEquals(result[0], "done");
  assertEquals(printed, [
    JSON.stringify({
      ...sample,
      links: [{ fromId: sample.id, toId: "other", relation: "relates to" }],
    }),
  ]);
});
