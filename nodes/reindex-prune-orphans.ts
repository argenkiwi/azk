import { NodeFactory } from "../ambler.ts";
import { deleteOrphans as dbDeleteOrphans } from "../utils/db.ts";
import { DB_PATH } from "../utils/config.ts";

export interface State {
  // Populated upstream by REINDEX_LIST — always set by the time this runs.
  allIds?: string[];
  removed?: number;
}

export type Edge = "onPruned";

export type Utils = {
  deleteOrphans: (liveIds: string[]) => string[];
};

const defaultUtils: Utils = {
  deleteOrphans: (liveIds) => dbDeleteOrphans(DB_PATH, liveIds),
};

/**
 * Drops index entries whose Markdown file no longer exists, keeping the
 * derived index in step with the notes directory.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
(state) => {
  const removed = utils.deleteOrphans(state.allIds ?? []).length;
  return [edges.onPruned, { ...state, removed }];
};
