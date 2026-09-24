import { NodeFactory } from "../ambler.ts";
import { AZK_DIR } from "../utils/config.ts";

// Reads nothing from the state; it only branches on the filesystem.
export type State = object;

export type Edge = "onMissing" | "onPresent";

export type Utils = {
  indexExists: () => Promise<boolean>;
};

const defaultUtils: Utils = {
  indexExists: async () => {
    try {
      await Deno.stat(AZK_DIR);
      return true;
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) return false;
      throw err;
    }
  },
};

/**
 * Branches on whether the project already has an index. An existing one is
 * left to the git hooks and explicit `reindex` runs, so re-running `setup`
 * stays cheap.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
async (state) => {
  const exists = await utils.indexExists();
  return [exists ? edges.onPresent : edges.onMissing, state];
};
