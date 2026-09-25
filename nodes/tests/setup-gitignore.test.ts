import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../setup-gitignore.ts";
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

Deno.test("setupGitignoreNode should append the entry when .azk isn't ignored", async () => {
  const { utils, writes } = fakeUtils("node_modules/\n");

  const result = await factory({ onDone: "done" }, utils)({} as State);

  assertEquals(result, ["done", { gitignore: "added" }]);
  assertEquals(writes, [`node_modules/\n${IGNORE_COMMENT}\n.azk/\n`]);
});

Deno.test("setupGitignoreNode should create .gitignore when there is none", async () => {
  const { utils, writes } = fakeUtils(null);

  const result = await factory({ onDone: "done" }, utils)({} as State);

  assertEquals(result, ["done", { gitignore: "added" }]);
  assertEquals(writes, [`${IGNORE_COMMENT}\n.azk/\n`]);
});

Deno.test("setupGitignoreNode should leave an existing rule alone", async () => {
  const { utils, writes } = fakeUtils("/.azk\n");

  const result = await factory({ onDone: "done" }, utils)({} as State);

  assertEquals(result, ["done", { gitignore: "present" }]);
  assertEquals(writes, []);
});
