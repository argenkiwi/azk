import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../clear-hooks.ts";
import { hookBlock } from "../../utils/setup.ts";

function fakeUtils(dir: string | null, files: Record<string, string>) {
  const writes: Record<string, string> = {};
  const deleted: string[] = [];
  const utils: Utils = {
    hooksDir: () => Promise.resolve(dir),
    readHook: (path) => Promise.resolve(files[path] ?? null),
    writeHook: (path, content) => {
      writes[path] = content;
      return Promise.resolve();
    },
    deleteHook: (path) => {
      deleted.push(path);
      return Promise.resolve();
    },
  };
  return { utils, writes, deleted };
}

Deno.test("clearHooksNode should skip outside a git repo", async () => {
  const { utils } = fakeUtils(null, {});

  const result = await factory({ onDone: "done" }, utils)({} as State);

  assertEquals(result, ["done", { hooks: "skipped" }]);
});

Deno.test("clearHooksNode should delete azk-only hooks and strip shared ones", async () => {
  const { utils, writes, deleted } = fakeUtils(".git/hooks", {
    ".git/hooks/post-checkout": `#!/bin/sh\n${hookBlock("post-checkout")}`,
    ".git/hooks/post-merge": `#!/bin/sh\n${
      hookBlock("post-merge")
    }npm install\n`,
    ".git/hooks/post-rewrite": "#!/bin/sh\necho unrelated\n",
  });

  const result = await factory({ onDone: "done" }, utils)({} as State);

  assertEquals(result, ["done", {
    hooks: {
      "post-checkout": "removed",
      "post-merge": "removed",
      "post-rewrite": "absent",
    },
  }]);
  assertEquals(deleted, [".git/hooks/post-checkout"]);
  assertEquals(writes, { ".git/hooks/post-merge": "#!/bin/sh\nnpm install\n" });
});
