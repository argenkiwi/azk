import { NodeFactory } from "../ambler.ts";
import {
  DEFAULT_EMBEDDING_HOST,
  DEFAULT_EMBEDDING_MODEL,
  embed as embedText,
} from "../utils/embeddings.ts";

export interface State {
  textToEmbed?: string;
  embedding?: number[] | null;
}

export type Edge = "onEmbedded";

export type Utils = {
  embed: (text: string) => Promise<number[] | null>;
};

const defaultUtils: Utils = {
  embed: (text) =>
    embedText(text, DEFAULT_EMBEDDING_MODEL, DEFAULT_EMBEDDING_HOST),
};

/**
 * Embeds `textToEmbed` when one is pending. Whether an embedding is wanted at
 * all is an upstream decision — a node sets `textToEmbed` only when it wants
 * one — so this node stays single-purpose and always takes its one edge:
 * `embed()` never throws, and a `null` result just means the embeddings host
 * was unreachable, degrading search to keyword-only rather than failing.
 *
 * `embedding` is written on every pass, never left untouched, so the reindex
 * loop cannot carry a previous note's vector into the next iteration.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
async (state) => {
  if (state.textToEmbed === undefined) {
    return [edges.onEmbedded, { ...state, embedding: null }];
  }

  const embedding = await utils.embed(state.textToEmbed);
  return [edges.onEmbedded, { ...state, embedding }];
};
