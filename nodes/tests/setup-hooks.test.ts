import { assertEquals } from "@std/assert";
import { factory, State, Utils } from "../setup-hooks.ts";
import { hookBlock } from "../../utils/setup.ts";

function fakeUtils(dir: string | null, files: Record<string, string>) {
  const writes: Record<string, string> = {};
  const utils: Utils = {
    hooksDir: () => Promise.resolve(dir),
    readHook: (path) => Promise.resolve(files[path] ?? null),
    writeHook: (path, content) => {
      writes[path] = content;
      return Promise.resolve();
    },
  };
  return { utils, writes };
}

Deno.test("setupHooksNode should skip outside a git repo", async () => {
  const { utils, writes } = fakeUtils(null, {});

  const result = await factory({ onDone: "done" }, utils)({} as State);

  assertEquals(result, ["done", { hooks: "skipped" }]);
  assertEquals(writes, {});
});

Deno.test("setupHooksNode should install, splice, keep and refuse as appropriate", async () => {
  const { utils, writes } = fakeUtils(".git/hooks", {
    ".git/hooks/post-merge": "#!/bin/sh\nnpm install\n",
    ".git/hooks/post-rewrite": `#!/bin/sh\n${hookBlock("post-rewrite")}`,
  });

  const result = await factory({ onDone: "done" }, utils)({} as State);

  assertEquals(result, ["done", {
    hooks: {
      "post-checkout": "installed",
      "post-merge": "installed",
      "post-rewrite": "present",
    },
  }]);
  assertEquals(writes, {
    ".git/hooks/post-checkout": `#!/bin/sh\n${hookBlock("post-checkout")}`,
    ".git/hooks/post-merge": `#!/bin/sh\n${
      hookBlock("post-merge")
    }npm install\n`,
  });
});

Deno.test("setupHooksNode should leave a non-shell hook untouched", async () => {
  const { utils, writes } = fakeUtils(".husky", {
    ".husky/post-checkout": "#!/usr/bin/env node\nconsole.log(1)\n",
  });

  const [, state] = await factory({ onDone: "done" }, utils)({} as State);

  assertEquals(
    (state.hooks as Record<string, string>)["post-checkout"],
    "unsupported",
  );
  assertEquals(".husky/post-checkout" in writes, false);
});
