import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../write-note.ts";
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

Deno.test("azkWriteNoteNode should persist the note when writing succeeds", async () => {
  const initialState: State = { note: sample };

  const written: Note[] = [];
  const utils: Utils = {
    writeNote: (note) => {
      written.push(note);
      return Promise.resolve();
    },
    print: () => {},
  };

  const result = await factory({ onWritten: "next", onError: "failed" }, utils)(
    initialState,
  );

  assertEquals(result[0], "next");
  assertEquals(written, [sample]);
  assertEquals(result[1].error, undefined);
});

Deno.test("azkWriteNoteNode should transition to onError when writing fails", async () => {
  const initialState: State = { note: sample };

  const printed: string[] = [];
  const utils: Utils = {
    writeNote: () => Promise.reject(new Error("disk full")),
    print: (msg) => printed.push(msg),
  };

  const result = await factory({ onWritten: "next", onError: "failed" }, utils)(
    initialState,
  );

  assertEquals(result[0], "failed");
  assertEquals(result[1].error, "disk full");
  assertEquals(printed, [JSON.stringify({ error: "disk full" })]);
});
