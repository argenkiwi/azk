import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../delete.ts";

Deno.test("azkDeleteNode should remove the note file and its index entry", async () => {
  const initialState: State = { id: "20260706120000" };

  const removedFiles: string[] = [];
  const removedEntries: string[] = [];
  const printed: string[] = [];

  const utils: Utils = {
    deleteNoteFile: (id) => {
      removedFiles.push(id);
      return Promise.resolve();
    },
    deleteAzk: (id) => {
      removedEntries.push(id);
      return true;
    },
    print: (msg) => printed.push(msg),
  };

  const result = await factory({ onDeleted: "done" }, utils)(initialState);

  assertEquals(result[0], "done");
  assertEquals(removedFiles, ["20260706120000"]);
  assertEquals(removedEntries, ["20260706120000"]);
  assertEquals(printed, [
    JSON.stringify({ id: "20260706120000", deleted: true }),
  ]);
});
