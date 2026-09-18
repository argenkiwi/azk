import { NodeFactory } from "../ambler.ts";
import { AzkLinkInput } from "../utils/db.ts";
import { Note } from "../utils/fs.ts";

export interface State {
  // Populated upstream by CREATE_INIT — always set by the time this runs.
  note?: Note;
  links?: AzkLinkInput[];
}

export type Edge = "onCreated";

export type Utils = {
  print: (msg: string) => void;
};

const defaultUtils: Utils = {
  print: (msg) => console.log(msg),
};

/**
 * Prints the created note's summary. Terminal node of the `create` chain: it
 * runs only once the note file, the index entry and the links have all been
 * written, so what it prints has actually happened.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
(state) => {
  const note = state.note!;

  utils.print(JSON.stringify({
    id: note.id,
    title: note.title,
    tags: note.tags,
    created: note.created,
    links: state.links ?? [],
  }));

  return [edges.onCreated, state];
};
