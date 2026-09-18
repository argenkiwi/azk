import { NodeFactory } from "../ambler.ts";
import { Note } from "../utils/fs.ts";

export interface State {
  // Populated upstream by UPDATE_EXISTS_CHECK — always set by the time this runs.
  note?: Note;
  title?: string;
  body?: string;
  tags?: string[];
  textToEmbed?: string;
}

export type Edge = "onMerged";

export type Utils = {
  now: () => string;
};

const defaultUtils: Utils = {
  now: () => new Date().toISOString(),
};

/**
 * Applies the supplied subset of `title`/`body`/`tags` over the existing
 * note and stamps `updated`. `textToEmbed` is set only when the body was
 * supplied — re-embedding a title or tag change would cost a round trip to
 * the embeddings host for a vector that wouldn't move.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
(state) => {
  const existing = state.note!;

  const note: Note = {
    ...existing,
    title: state.title ?? existing.title,
    body: state.body ?? existing.body,
    tags: state.tags ?? existing.tags,
    updated: utils.now(),
  };

  return [edges.onMerged, { ...state, note, textToEmbed: state.body }];
};
