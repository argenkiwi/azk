import { NodeFactory } from "../ambler.ts";
import {
  AzkMeta,
  getAllEmbeddings as dbGetAllEmbeddings,
  getAzkMeta as dbGetAzkMeta,
  RankedAzk,
} from "../utils/db.ts";
import { cosineSimilarity } from "../utils/embeddings.ts";
import { DB_PATH } from "../utils/config.ts";

export interface State {
  // Populated upstream by SEARCH_INPUT and SEARCH_EMBED.
  limit?: number;
  embedding?: number[] | null;
  semanticResults?: RankedAzk[];
}

export type Edge = "onScored";

export type Utils = {
  getAllEmbeddings: () => { id: string; vector: number[] }[];
  getAzkMeta: (id: string) => AzkMeta | null;
};

const defaultUtils: Utils = {
  getAllEmbeddings: () => dbGetAllEmbeddings(DB_PATH),
  getAzkMeta: (id) => dbGetAzkMeta(DB_PATH, id),
};

/**
 * Scores every indexed note against the query vector and keeps the closest
 * `limit`. A `null` embedding means the embeddings host was unreachable, so
 * this contributes nothing and search degrades to keyword-only rather than
 * failing. Ids whose index metadata has since gone are dropped.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
(state) => {
  if (!state.embedding) {
    return [edges.onScored, { ...state, semanticResults: [] }];
  }

  const queryVector = state.embedding;

  const semanticResults: RankedAzk[] = utils
    .getAllEmbeddings()
    .map(({ id, vector }) => ({
      id,
      similarity: cosineSimilarity(queryVector, vector),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, state.limit!)
    .flatMap(({ id, similarity }) => {
      const note = utils.getAzkMeta(id);
      if (!note) return [];

      return [{
        id: note.id,
        title: note.title,
        tags: note.tags,
        created: note.created,
        score: similarity,
      }];
    });

  return [edges.onScored, { ...state, semanticResults }];
};
