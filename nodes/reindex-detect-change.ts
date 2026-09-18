import { NodeFactory } from "../ambler.ts";
import { getAzkMeta as dbGetAzkMeta } from "../utils/db.ts";
import {
  hashContent as fsHashContent,
  Note,
  readNote as fsReadNote,
} from "../utils/fs.ts";
import { DB_PATH } from "../utils/config.ts";

export interface State {
  // Populated upstream by REINDEX_NEXT — always set by the time this runs.
  id?: string;
  note?: Note;
  textToEmbed?: string;
  indexed?: number;
  updated?: number;
}

export type Edge = "onChecked" | "onMissing";

export type Utils = {
  readNote: (id: string) => Promise<Note | null>;
  getAzkMeta: (id: string) => { bodyHash: string } | null;
  hashContent: (text: string) => Promise<string>;
};

const defaultUtils: Utils = {
  readNote: (id) => fsReadNote(id),
  getAzkMeta: (id) => dbGetAzkMeta(DB_PATH, id),
  hashContent: (text) => fsHashContent(text),
};

/**
 * Decides whether the current note needs re-embedding, by comparing its body
 * hash against the one the index holds. The note is always re-upserted and
 * its links always rebuilt downstream — only the embedding is conditional,
 * because that's the one step that costs a network round trip.
 *
 * `textToEmbed` is written on every pass, cleared when nothing changed, so
 * the loop cannot carry the previous note's body into this one's embedding.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
async (state) => {
  const note = await utils.readNote(state.id!);

  // The file vanished between listing and reading it — nothing to index.
  if (!note) return [edges.onMissing, state];

  const bodyHash = await utils.hashContent(note.body);
  const existing = utils.getAzkMeta(state.id!);
  const changed = !existing || existing.bodyHash !== bodyHash;

  return [edges.onChecked, {
    ...state,
    note,
    textToEmbed: changed ? note.body : undefined,
    indexed: state.indexed! + (existing ? 0 : 1),
    updated: state.updated! + (existing && changed ? 1 : 0),
  }];
};
