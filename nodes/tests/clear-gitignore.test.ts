import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../clear-gitignore.ts";
import { IGNORE_COMMENT } from "../../utils/setup.ts";

function fakeUtils(initial: string | null) {
  const writes: string[] = [];
  const utils: Utils = {
    readGitignore: () => Promise.resolve(initial),
    writeGitignore: (content) => {
      writes.push(content);
      return Promise.resolve();
    },
  };
  return { utils, writes };
}

Deno.test("clearGitignoreNode should remove the entry and its comment", async () => {
  const { utils, writes } = fakeUtils(`dist/\n${IGNORE_COMMENT}\n.azk/\n`);

  const result = await factory({ onDone: "done" }, utils)({} as State);

  assertEquals(result, ["done", { gitignore: "removed" }]);
  assertEquals(writes, ["dist/\n"]);
});

Deno.test("clearGitignoreNode should report absent when nothing ignores .azk", async () => {
  const { utils, writes } = fakeUtils("dist/\n");

  const result = await factory({ onDone: "done" }, utils)({} as State);

  assertEquals(result, ["done", { gitignore: "absent" }]);
  assertEquals(writes, []);
});

Deno.test("clearGitignoreNode should report absent when there is no .gitignore", async () => {
  const { utils, writes } = fakeUtils(null);

  const result = await factory({ onDone: "done" }, utils)({} as State);

  assertEquals(result, ["done", { gitignore: "absent" }]);
  assertEquals(writes, []);
});
