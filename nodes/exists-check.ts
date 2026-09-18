import { NodeFactory } from "../ambler.ts";
import { Note, readNote as fsReadNote } from "../utils/fs.ts";

export interface State {
  // Populated upstream by ID_ARG — always set by the time this node runs.
  id?: string;
  note?: Note;
  error?: string;
}

export type Edge = "onFound" | "onNotFound";

export type Utils = {
  readNote: (id: string) => Promise<Note | null>;
  print: (msg: string) => void;
};

const defaultUtils: Utils = {
  readNote: (id) => fsReadNote(id),
  print: (msg) => console.log(msg),
};

/**
 * Reads a note by id and branches on whether it exists, attaching it to state
 * so downstream nodes don't have to read it again. A missing id prints
 * `{ error }` and takes the `onNotFound` edge — the process still exits 0
 * unless the caller maps that edge to an explicit non-zero exit.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
async (state) => {
  const note = await utils.readNote(state.id!);

  if (!note) {
    const error = `Azk not found: ${state.id}`;
    utils.print(JSON.stringify({ error }));
    return [edges.onNotFound, { ...state, error }];
  }

  return [edges.onFound, { ...state, note }];
};
