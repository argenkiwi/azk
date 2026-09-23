import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../id-arg.ts";

const utils: Utils = {
  usage: (verb) => `Usage: azk ${verb} <id>`,
};

Deno.test("azkIdArgNode should read the id from the verb's first argument", async () => {
  const initialState: State = { verb: "get", args: ["20260706120000"] };

  const result = await factory({ onParsed: "next", onMissing: "usage" }, utils)(
    initialState,
  );

  assertEquals(result[0], "next");
  assertEquals(result[1].id, "20260706120000");
  assertEquals(result[1].usage, undefined);
});

Deno.test("azkIdArgNode should transition to onMissing when no id was given", async () => {
  const initialState: State = { verb: "get", args: [] };

  const result = await factory({ onParsed: "next", onMissing: "usage" }, utils)(
    initialState,
  );

  assertEquals(result[0], "usage");
  assertEquals(result[1].id, undefined);
  assertEquals(result[1].usage, "Usage: azk get <id>");
});

Deno.test("azkIdArgNode should use the injected usage line when one is wired in", async () => {
  const initialState: State = { verb: "update", args: [] };

  const result = await factory(
    { onParsed: "next", onMissing: "usage" },
    { usage: () => "custom usage" },
  )(initialState);

  assertEquals(result[0], "usage");
  assertEquals(result[1].usage, "custom usage");
});
