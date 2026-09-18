import { NodeFactory } from "../ambler.ts";
import { deleteAzk as dbDeleteAzk } from "../utils/db.ts";
import { deleteNoteFile as fsDeleteNoteFile } from "../utils/fs.ts";
import { DB_PATH } from "../utils/config.ts";

export interface State {
  // Populated upstream by DELETE_ID_ARG and DELETE_EXISTS_CHECK.
  id?: string;
}

export type Edge = "onDeleted";

export type Utils = {
  deleteNoteFile: (id: string) => Promise<void>;
  deleteAzk: (id: string) => boolean;
  print: (msg: string) => void;
};

const defaultUtils: Utils = {
  deleteNoteFile: (id) => fsDeleteNoteFile(id),
  deleteAzk: (id) => dbDeleteAzk(DB_PATH, id),
  print: (msg) => console.log(msg),
};

/**
 * Removes the note's Markdown file, its index entry, and any links
 * referencing it in either direction. Terminal node of the `delete` chain;
 * the existence check upstream has already ruled out a missing id.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
async (state) => {
  await utils.deleteNoteFile(state.id!);
  utils.deleteAzk(state.id!);

  utils.print(JSON.stringify({ id: state.id, deleted: true }));

  return [edges.onDeleted, state];
};
