import { NodeFactory } from "../ambler.ts";

export interface State {
  // Set by SETUP_GITIGNORE and SETUP_HOOKS.
  gitignore?: string;
  hooks?: Record<string, string> | "skipped";
  // Set by the reindex chain, only when SETUP_INDEX_CHECK found no index.
  indexed?: number;
  updated?: number;
  removed?: number;
  total?: number;
}

export type Edge = "onDone";

export type Utils = {
  print: (msg: string) => void;
};

const defaultUtils: Utils = {
  print: (msg) => console.log(msg),
};

/**
 * Prints what `setup` did. Stands in for the reindex chain's own finish node,
 * so a setup that builds the index still prints a single JSON value.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
(state) => {
  utils.print(JSON.stringify({
    gitignore: state.gitignore,
    hooks: state.hooks,
    reindex: state.total === undefined ? "skipped" : {
      indexed: state.indexed,
      updated: state.updated,
      removed: state.removed,
      total: state.total,
    },
  }));

  return [edges.onDone, state];
};
