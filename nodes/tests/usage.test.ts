import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../usage.ts";

Deno.test("azkUsageNode should print the pending usage message to stderr", async () => {
  const initialState: State = { usage: "Usage: azk get <id>" };

  const printed: string[] = [];
  const utils: Utils = { printErr: (msg) => printed.push(msg) };

  const result = await factory({ onExplained: "done" }, utils)(initialState);

  assertEquals(result[0], "done");
  assertEquals(printed, ["Usage: azk get <id>"]);
});
