import { NodeFactory } from "../ambler.ts";
import { upsertAzk as dbUpsertAzk } from "../utils/db.ts";
import { hashContent as fsHashContent, Note } from "../utils/fs.ts";
import { DB_PATH } from "../utils/config.ts";

export interface State {
  // Populated upstream (CREATE_INIT, UPDATE_MERGE or REINDEX_DETECT_CHANGE) —
  // always set by the time this node runs.
  note?: Note;
  embedding?: number[] | null;
  error?: string;
}

export type Edge = "onIndexed" | "onError";

export type Utils = {
  hashContent: (text: string) => Promise<string>;
  upsertAzk: (
    note: {
      id: string;
      title: string;
      body: string;
      tags: string[];
      created: string;
      updated: string;
      bodyHash: string;
    },
    embedding?: number[],
  ) => void;
  print: (msg: string) => void;
};

const defaultUtils: Utils = {
  hashContent: (text) => fsHashContent(text),
  upsertAzk: (note, embedding) => dbUpsertAzk(DB_PATH, note, embedding),
  print: (msg) => console.log(msg),
};

/**
 * Upserts `state.note` into the derived SQLite index, hashing the body so a
 * later reindex can tell whether it changed. A `null` embedding is passed as
 * `undefined`, which leaves any previously stored vector alone. On failure,
 * prints `{ error }` and takes the `onError` edge — the process still exits 0
 * unless the caller maps that edge to an explicit non-zero exit.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
async (state) => {
  const note = state.note!;

  try {
    const bodyHash = await utils.hashContent(note.body);
    utils.upsertAzk(
      {
        id: note.id,
        title: note.title,
        body: note.body,
        tags: note.tags,
        created: note.created,
        updated: note.updated,
        bodyHash,
      },
      state.embedding ?? undefined,
    );

    return [edges.onIndexed, state];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    utils.print(JSON.stringify({ error: message }));
    return [edges.onError, { ...state, error: message }];
  }
};
