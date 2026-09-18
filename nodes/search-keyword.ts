import { NodeFactory } from "../ambler.ts";
import { AzkMeta, RankedAzk, searchAzk as dbSearchAzk } from "../utils/db.ts";
import { DB_PATH } from "../utils/config.ts";

export interface State {
  // Populated upstream by SEARCH_INPUT — always set by the time this runs.
  query?: string;
  limit?: number;
  keywordResults?: RankedAzk[];
  textToEmbed?: string;
}

export type Edge = "onSearched";

export type Utils = {
  searchAzk: (query: string, limit: number) => AzkMeta[];
};

const defaultUtils: Utils = {
  searchAzk: (query, limit) => dbSearchAzk(DB_PATH, query, limit),
};

/**
 * Runs the FTS5 keyword search and scores matches by rank position, best
 * first, so semantic similarity can be added on top later. Also queues the
 * query for embedding — an empty keyword result is not a dead end, since
 * semantic search can still surface notes sharing no keywords with it.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
(state) => {
  const matches = utils.searchAzk(state.query!, state.limit!);

  const keywordResults: RankedAzk[] = matches.map((note, index) => ({
    id: note.id,
    title: note.title,
    tags: note.tags,
    created: note.created,
    score: matches.length - index,
  }));

  return [edges.onSearched, {
    ...state,
    keywordResults,
    textToEmbed: state.query,
  }];
};
