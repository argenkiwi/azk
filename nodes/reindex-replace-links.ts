import { NodeFactory } from "../ambler.ts";
import { replaceLinksForNote as dbReplaceLinksForNote } from "../utils/db.ts";
import { Note } from "../utils/fs.ts";
import { DB_PATH } from "../utils/config.ts";

export interface State {
  // Populated upstream by REINDEX_DETECT_CHANGE — always set by the time this runs.
  id?: string;
  note?: Note;
}

export type Edge = "onReplaced";

export type Utils = {
  replaceLinksForNote: (
    fromId: string,
    links: { to: string; relation: string }[],
  ) => void;
};

const defaultUtils: Utils = {
  replaceLinksForNote: (fromId, links) =>
    dbReplaceLinksForNote(DB_PATH, fromId, links),
};

/**
 * Rebuilds the current note's outgoing links in the index from its own
 * frontmatter. Runs for every note, changed or not, so a hand-edit that only
 * touched frontmatter links is still picked up.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
(state) => {
  utils.replaceLinksForNote(state.id!, state.note!.links);
  return [edges.onReplaced, state];
};
