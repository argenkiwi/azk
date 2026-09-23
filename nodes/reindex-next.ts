import { NodeFactory } from "../ambler.ts";

export interface State {
  // Populated upstream by REINDEX_LIST — always set by the time this runs.
  remainingIds?: string[];
  id?: string;
}

export type Edge = "onNext" | "onDone";

/**
 * Takes the next note id off the queue, or ends the loop when it's empty.
 * This is the only node that decides how long the reindex runs.
 */
export const factory: NodeFactory<State, Edge> = (edges) => (state) => {
  const [id, ...remainingIds] = state.remainingIds ?? [];

  if (!id) return [edges.onDone, state];

  return [edges.onNext, { ...state, id, remainingIds }];
};
