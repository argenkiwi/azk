import { NodeFactory } from "../ambler.ts";

export interface State {
  // Populated upstream by DISPATCH — the verb and its remaining arguments.
  verb?: string;
  args?: string[];
  id?: string;
  usage?: string;
}

export type Edge = "onParsed" | "onMissing";

export type Utils = {
  usage: (verb: string) => string;
};

const defaultUtils: Utils = {
  usage: (verb) => `Usage: azk ${verb} <id>`,
};

/**
 * Reads a note id from the verb's first argument. The usage line is built
 * from `state.verb`, so one node serves `get`, `update` and `delete`; a
 * wiring that needs a richer hint injects its own `usage` builder.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
(state) => {
  const id = state.args?.[0];

  if (!id) {
    return [edges.onMissing, { ...state, usage: utils.usage(state.verb!) }];
  }

  return [edges.onParsed, { ...state, id }];
};
