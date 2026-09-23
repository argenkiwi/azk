import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../embed.ts";

Deno.test("azkEmbedNode should embed the pending text when one is set", async () => {
  const initialState: State = { textToEmbed: "alpha" };

  const embedded: string[] = [];
  const utils: Utils = {
    embed: (text) => {
      embedded.push(text);
      return Promise.resolve([0.1, 0.2]);
    },
  };

  const result = await factory({ onEmbedded: "next" }, utils)(initialState);

  assertEquals(result[0], "next");
  assertEquals(embedded, ["alpha"]);
  assertEquals(result[1].embedding, [0.1, 0.2]);
});

Deno.test("azkEmbedNode should clear the embedding when no text is pending", async () => {
  const initialState: State = { embedding: [0.9] };

  const embedded: string[] = [];
  const utils: Utils = {
    embed: (text) => {
      embedded.push(text);
      return Promise.resolve([0.1]);
    },
  };

  const result = await factory({ onEmbedded: "next" }, utils)(initialState);

  assertEquals(result[0], "next");
  assertEquals(embedded, []);
  // Explicitly null, not left over from a previous loop iteration.
  assertEquals(result[1].embedding, null);
});
