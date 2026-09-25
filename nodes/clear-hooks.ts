import { NodeFactory } from "../ambler.ts";
import { HOOK_NAMES } from "../utils/config.ts";
import { readTextIfExists, removeIfExists } from "../utils/fs.ts";
import { hooksDir as gitHooksDir } from "../utils/git.ts";
import { hasHookBlock, removeHookBlock } from "../utils/setup.ts";

export interface State {
  hooks?: Record<string, "removed" | "absent"> | "skipped";
}

export type Edge = "onDone";

export type Utils = {
  hooksDir: () => Promise<string | null>;
  readHook: (path: string) => Promise<string | null>;
  writeHook: (path: string, content: string) => Promise<void>;
  deleteHook: (path: string) => Promise<void>;
};

const defaultUtils: Utils = {
  hooksDir: () => gitHooksDir(),
  readHook: (path) => readTextIfExists(path),
  // Overwriting in place keeps the file's existing mode.
  writeHook: (path, content) => Deno.writeTextFile(path, content),
  deleteHook: async (path) => {
    await removeIfExists(path);
  },
};

/**
 * Cuts azk's block out of each git hook, deleting a hook that held nothing
 * else, and leaving whatever else a shared hook does untouched.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
async (state) => {
  const dir = await utils.hooksDir();
  if (dir === null) return [edges.onDone, { ...state, hooks: "skipped" }];

  const hooks: Record<string, "removed" | "absent"> = {};
  for (const name of HOOK_NAMES) {
    const path = `${dir}/${name}`;
    const content = await utils.readHook(path);

    if (content === null || !hasHookBlock(content)) {
      hooks[name] = "absent";
      continue;
    }

    const rest = removeHookBlock(content);
    if (rest === null) await utils.deleteHook(path);
    else await utils.writeHook(path, rest);
    hooks[name] = "removed";
  }

  return [edges.onDone, { ...state, hooks }];
};
