import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../update-finish.ts";

Deno.test("azkUpdateFinishNode should print the updated record", async () => {
  const initialState: State = { id: "20260706120000" };

  const printed: string[] = [];
  const utils: Utils = { print: (msg) => printed.push(msg) };

  const result = await factory({ onUpdated: "done" }, utils)(initialState);

  assertEquals(result[0], "done");
  assertEquals(printed, [
    JSON.stringify({ id: "20260706120000", updated: true }),
  ]);
});
