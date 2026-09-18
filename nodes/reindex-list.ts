import { NodeFactory } from "../ambler.ts";
import { listNoteIds as fsListNoteIds } from "../utils/fs.ts";

export interface State {
  allIds?: string[];
  remainingIds?: string[];
  indexed?: number;
  updated?: number;
  total?: number;
}

export type Edge = "onListed";

export type Utils = {
  listNoteIds: () => Promise<string[]>;
};

const defaultUtils: Utils = {
  listNoteIds: () => fsListNoteIds(),
};

/**
 * Seeds the reindex loop from the Markdown files on disk — the source of
 * truth — and zeroes the counters the later nodes accumulate into.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
async (state) => {
  const allIds = await utils.listNoteIds();

  return [edges.onListed, {
    ...state,
    allIds,
    remainingIds: allIds,
    indexed: 0,
    updated: 0,
    total: allIds.length,
  }];
};
