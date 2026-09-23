import { NodeFactory } from "../ambler.ts";

/** Results returned when the caller doesn't ask for a specific number. */
const DEFAULT_LIMIT = 5;

export interface State {
  // Populated upstream by DISPATCH — the verb's arguments, verb removed.
  args?: string[];
  query?: string;
  limit?: number;
  usage?: string;
}

export type Edge = "onParsed" | "onMissing";

/**
 * Reads the query and optional result limit from the arguments, resolving the
 * limit to a concrete number so the three ranking nodes downstream all agree
 * on how many results they are working towards.
 */
export const factory: NodeFactory<State, Edge> = (edges) => (state) => {
  const [query, limit] = state.args ?? [];

  if (!query) {
    return [edges.onMissing, {
      ...state,
      usage: 'Usage: azk search "<query>" [limit]',
    }];
  }

  return [edges.onParsed, {
    ...state,
    query,
    limit: limit ? Number(limit) : DEFAULT_LIMIT,
  }];
};
