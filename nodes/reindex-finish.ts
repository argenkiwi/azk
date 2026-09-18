import { NodeFactory } from "../ambler.ts";

export interface State {
  // Counted by REINDEX_LIST, REINDEX_DETECT_CHANGE and REINDEX_PRUNE_ORPHANS.
  indexed?: number;
  updated?: number;
  removed?: number;
  total?: number;
}

export type Edge = "onIndexed";

export type Utils = {
  print: (msg: string) => void;
};

const defaultUtils: Utils = {
  print: (msg) => console.log(msg),
};

/**
 * Prints the reindex summary. Terminal node of the `reindex` chain, so the
 * counters it reports are final.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
(state) => {
  utils.print(JSON.stringify({
    indexed: state.indexed,
    updated: state.updated,
    removed: state.removed,
    total: state.total,
  }));

  return [edges.onIndexed, state];
};
