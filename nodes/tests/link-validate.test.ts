import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../link-validate.ts";
import { Note } from "../../utils/fs.ts";

function note(id: string): Note {
  return {
    id,
    title: id,
    tags: [],
    created: "2026-07-06T12:00:00.000Z",
    updated: "2026-07-06T12:00:00.000Z",
    links: [],
    body: "Body",
  };
}

const initialState: State = {
  fromId: "from-id",
  toId: "to-id",
  relation: "relates to",
};

Deno.test("azkLinkValidateNode should append the link to the source note when both exist", async () => {
  const utils: Utils = {
    readNote: (id) => Promise.resolve(note(id)),
    now: () => "2026-07-07T09:00:00.000Z",
    print: () => {},
  };

  const result = await factory({ onValid: "next", onError: "failed" }, utils)(
    initialState,
  );

  assertEquals(result[0], "next");
  assertEquals(result[1].note?.links, [{
    to: "to-id",
    relation: "relates to",
  }]);
  assertEquals(result[1].note?.updated, "2026-07-07T09:00:00.000Z");
  assertEquals(result[1].links, [{ toId: "to-id", relation: "relates to" }]);
});

Deno.test("azkLinkValidateNode should transition to onError when either note is missing", async () => {
  const printed: string[] = [];
  const utils: Utils = {
    readNote: (id) => Promise.resolve(id === "from-id" ? note(id) : null),
    now: () => "2026-07-07T09:00:00.000Z",
    print: (msg) => printed.push(msg),
  };

  const result = await factory({ onValid: "next", onError: "failed" }, utils)(
    initialState,
  );

  const error =
    "Cannot link: one or both azk entries not found (from-id, to-id)";

  assertEquals(result[0], "failed");
  assertEquals(result[1].error, error);
  assertEquals(printed, [JSON.stringify({ error })]);
});
