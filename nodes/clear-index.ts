import { NodeFactory } from "../ambler.ts";
import { AZK_DIR } from "../utils/config.ts";
import { removeIfExists } from "../utils/fs.ts";

export interface State {
  index?: "deleted" | "absent";
}

export type Edge = "onDone";

export type Utils = {
  deleteIndex: () => Promise<boolean>;
};

const defaultUtils: Utils = {
  deleteIndex: () => removeIfExists(AZK_DIR),
};

/**
 * Deletes `.azk/` outright. Safe, since everything in it is derived from
 * `notes/`, which `clear` never touches.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
async (state) => {
  const deleted = await utils.deleteIndex();
  return [edges.onDone, { ...state, index: deleted ? "deleted" : "absent" }];
};
