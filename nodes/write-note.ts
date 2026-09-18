import { NodeFactory } from "../ambler.ts";
import { Note, writeNote as fsWriteNote } from "../utils/fs.ts";

export interface State {
  // Populated upstream (CREATE_INIT, UPDATE_MERGE or LINK_VALIDATE) — always
  // set by the time this node runs.
  note?: Note;
  error?: string;
}

export type Edge = "onWritten" | "onError";

export type Utils = {
  writeNote: (note: Note) => Promise<void>;
  print: (msg: string) => void;
};

const defaultUtils: Utils = {
  writeNote: (note) => fsWriteNote(note),
  print: (msg) => console.log(msg),
};

/**
 * Persists `state.note` to its Markdown file — the source of truth, written
 * before the derived index is touched. On failure, prints `{ error }` and
 * takes the `onError` edge; the process still exits 0 unless the caller maps
 * that edge to an explicit non-zero exit.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
async (state) => {
  try {
    await utils.writeNote(state.note!);
    return [edges.onWritten, state];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    utils.print(JSON.stringify({ error: message }));
    return [edges.onError, { ...state, error: message }];
  }
};
