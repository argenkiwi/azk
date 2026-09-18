import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../link-finish.ts";

Deno.test("azkLinkFinishNode should print the link confirmation", async () => {
  const initialState: State = {
    fromId: "from-id",
    toId: "to-id",
    relation: "relates to",
  };

  const printed: string[] = [];
  const utils: Utils = { print: (msg) => printed.push(msg) };

  const result = await factory({ onLinked: "done" }, utils)(initialState);

  assertEquals(result[0], "done");
  assertEquals(printed, [
    JSON.stringify({
      fromId: "from-id",
      toId: "to-id",
      relation: "relates to",
      linked: true,
    }),
  ]);
});
