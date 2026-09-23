import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../update-input.ts";

Deno.test("azkUpdateInputNode should read the partial update from stdin", async () => {
  const initialState: State = {};

  const utils: Utils = {
    readStdinJson: () => Promise.resolve({ body: "Revised.", tags: ["sync"] }),
  };

  const result = await factory({ onParsed: "next", onInvalid: "usage" }, utils)(
    initialState,
  );

  assertEquals(result[0], "next");
  assertEquals(result[1].title, undefined);
  assertEquals(result[1].body, "Revised.");
  assertEquals(result[1].tags, ["sync"]);
});

Deno.test("azkUpdateInputNode should transition to onInvalid when stdin is not valid JSON", async () => {
  const initialState: State = {};

  const utils: Utils = {
    readStdinJson: () => Promise.reject(new SyntaxError("Unexpected end")),
  };

  const result = await factory({ onParsed: "next", onInvalid: "usage" }, utils)(
    initialState,
  );

  assertEquals(result[0], "usage");
  assertEquals(
    result[1].usage,
    JSON.stringify({ error: "invalid JSON on stdin" }),
  );
});
