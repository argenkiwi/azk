import { NodeFactory } from "../ambler.ts";

export interface State {
  // Populated upstream by LINK_INPUT — always set by the time this runs.
  fromId?: string;
  toId?: string;
  relation?: string;
}

export type Edge = "onLinked";

export type Utils = {
  print: (msg: string) => void;
};

const defaultUtils: Utils = {
  print: (msg) => console.log(msg),
};

/**
 * Prints the link confirmation. Terminal node of the `link` chain, so it runs
 * only once the source note and the link graph have both been written.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
(state) => {
  utils.print(JSON.stringify({
    fromId: state.fromId,
    toId: state.toId,
    relation: state.relation,
    linked: true,
  }));

  return [edges.onLinked, state];
};
