import { NodeFactory } from "../ambler.ts";
import { HOOK_NAMES } from "../utils/config.ts";
import { readTextIfExists } from "../utils/fs.ts";
import { hooksDir as gitHooksDir } from "../utils/git.ts";
import { addHookBlock, hasHookBlock, isShellHook } from "../utils/setup.ts";

export type HookStatus = "installed" | "present" | "unsupported";

export interface State {
  hooks?: Record<string, HookStatus> | "skipped";
}

export type Edge = "onDone";

export type Utils = {
  hooksDir: () => Promise<string | null>;
  readHook: (path: string) => Promise<string | null>;
  writeHook: (path: string, content: string) => Promise<void>;
};

const defaultUtils: Utils = {
  hooksDir: () => gitHooksDir(),
  readHook: (path) => readTextIfExists(path),
  writeHook: async (path, content) => {
    await Deno.mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
    await Deno.writeTextFile(path, content);
    await Deno.chmod(path, 0o755);
  },
};

/**
 * Installs a reindex into each git hook after which `notes/` may have
 * changed, splicing it into any hook already there rather than replacing it.
 * A hook in another language is left alone and reported `unsupported`, and
 * outside a git repo the whole step is `skipped` rather than failing.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
async (state) => {
  const dir = await utils.hooksDir();
  if (dir === null) return [edges.onDone, { ...state, hooks: "skipped" }];

  const hooks: Record<string, HookStatus> = {};
  for (const name of HOOK_NAMES) {
    const path = `${dir}/${name}`;
    const content = await utils.readHook(path);

    if (content !== null && hasHookBlock(content)) {
      hooks[name] = "present";
    } else if (content !== null && !isShellHook(content)) {
      hooks[name] = "unsupported";
    } else {
      await utils.writeHook(path, addHookBlock(name, content));
      hooks[name] = "installed";
    }
  }

  return [edges.onDone, { ...state, hooks }];
};
