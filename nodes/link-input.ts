import { NodeFactory } from "../ambler.ts";

export interface State {
  // Populated upstream by DISPATCH — the verb's arguments, verb removed.
  args?: string[];
  fromId?: string;
  toId?: string;
  relation?: string;
  usage?: string;
}

export type Edge = "onParsed" | "onMissing";

/** Reads the source id, target id and relation phrase from the arguments. */
export const factory: NodeFactory<State, Edge> = (edges) => (state) => {
  const [fromId, toId, relation] = state.args ?? [];

  if (!fromId || !toId || !relation) {
    return [edges.onMissing, {
      ...state,
      usage: 'Usage: azk link <fromId> <toId> "<relation>"',
    }];
  }

  return [edges.onParsed, { ...state, fromId, toId, relation }];
};
