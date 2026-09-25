import { NodeFactory } from "../ambler.ts";

export interface State {
  // Set by CLEAR_GITIGNORE, CLEAR_HOOKS and CLEAR_INDEX.
  gitignore?: string;
  hooks?: Record<string, string> | "skipped";
  index?: string;
}

export type Edge = "onDone";

export type Utils = {
  print: (msg: string) => void;
};

const defaultUtils: Utils = {
  print: (msg) => console.log(msg),
};

/** Prints what `clear` undid. */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
(state) => {
  utils.print(JSON.stringify({
    gitignore: state.gitignore,
    hooks: state.hooks,
    index: state.index,
  }));

  return [edges.onDone, state];
};
