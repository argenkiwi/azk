import { NodeFactory } from "../ambler.ts";

export interface State {
  // Populated upstream by UPDATE_ID_ARG — always set by the time this runs.
  id?: string;
}

export type Edge = "onUpdated";

export type Utils = {
  print: (msg: string) => void;
};

const defaultUtils: Utils = {
  print: (msg) => console.log(msg),
};

/**
 * Prints the update confirmation. Terminal node of the `update` chain, so it
 * runs only once the note file and the index entry have both been rewritten.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
(state) => {
  utils.print(JSON.stringify({ id: state.id, updated: true }));
  return [edges.onUpdated, state];
};
