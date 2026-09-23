import { NodeFactory } from "../ambler.ts";
import { RankedAzk } from "../utils/db.ts";

export interface State {
  // Populated upstream by SEARCH_KEYWORD and SEARCH_SEMANTIC.
  limit?: number;
  keywordResults?: RankedAzk[];
  semanticResults?: RankedAzk[];
}

export type Edge = "onFound" | "onEmpty";

export type Utils = {
  print: (msg: string) => void;
};

const defaultUtils: Utils = {
  print: (msg) => console.log(msg),
};

/**
 * Blends the two rankings, best match first. Semantic scoring is additive: it
 * boosts a note that also matched by keyword and admits one that matched only
 * semantically. An empty result set is not an error — it prints `[]` and
 * still takes `onEmpty`, exiting 0.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
(state) => {
  const ranked = new Map<string, RankedAzk>(
    (state.keywordResults ?? []).map((match) => [match.id, { ...match }]),
  );

  for (const match of state.semanticResults ?? []) {
    const existing = ranked.get(match.id);
    if (existing) existing.score += match.score;
    else ranked.set(match.id, { ...match });
  }

  const results = Array.from(ranked.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, state.limit!);

  utils.print(JSON.stringify(results));

  return [results.length === 0 ? edges.onEmpty : edges.onFound, state];
};
