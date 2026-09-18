import { NodeFactory } from "../ambler.ts";
import { AzkLink, getLinks as dbGetLinks } from "../utils/db.ts";
import { Note } from "../utils/fs.ts";
import { DB_PATH } from "../utils/config.ts";

export interface State {
  // Populated upstream by GET_ID_ARG and GET_EXISTS_CHECK.
  id?: string;
  note?: Note;
}

export type Edge = "onFound";

export type Utils = {
  getLinks: (id: string) => AzkLink[];
  print: (msg: string) => void;
};

const defaultUtils: Utils = {
  getLinks: (id) => dbGetLinks(DB_PATH, id),
  print: (msg) => console.log(msg),
};

/**
 * Prints the note the existence check already read, plus every link touching
 * it in either direction. Terminal node of the `get` chain.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
(state) => {
  utils.print(JSON.stringify({
    ...state.note!,
    links: utils.getLinks(state.id!),
  }));

  return [edges.onFound, state];
};
