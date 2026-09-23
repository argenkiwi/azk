import { NodeFactory } from "../ambler.ts";

export interface State {
  // Populated by DISPATCH or by whichever input node rejected its arguments.
  usage?: string;
}

export type Edge = "onExplained";

export type Utils = {
  printErr: (msg: string) => void;
};

const defaultUtils: Utils = {
  printErr: (msg) => console.error(msg),
};

/**
 * Prints the pending usage message to stderr, keeping stdout reserved for the
 * single JSON value a successful run produces. Leaves `usage` on the state so
 * the walk can map a bad invocation to a non-zero exit.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
(state) => {
  utils.printErr(state.usage!);
  return [edges.onExplained, state];
};
