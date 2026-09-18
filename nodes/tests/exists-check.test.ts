import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../exists-check.ts";
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

Deno.test("azkExistsCheckNode should attach the note when the id exists", async () => {
  const initialState: State = { id: sample.id };

  const utils: Utils = {
    readNote: (id) => Promise.resolve(id === sample.id ? sample : null),
    print: () => {},
  };

  const result = await factory(
    { onFound: "next", onNotFound: "missing" },
    utils,
  )(
    initialState,
  );

  assertEquals(result[0], "next");
  assertEquals(result[1].note, sample);
});

Deno.test("azkExistsCheckNode should transition to onNotFound when the id does not exist", async () => {
  const initialState: State = { id: "missing-id" };

  const printed: string[] = [];
  const utils: Utils = {
    readNote: () => Promise.resolve(null),
    print: (msg) => printed.push(msg),
  };

  const result = await factory(
    { onFound: "next", onNotFound: "missing" },
    utils,
  )(
    initialState,
  );

  assertEquals(result[0], "missing");
  assertEquals(result[1].error, "Azk not found: missing-id");
  assertEquals(printed, [
    JSON.stringify({ error: "Azk not found: missing-id" }),
  ]);
});
