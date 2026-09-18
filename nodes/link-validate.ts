import { NodeFactory } from "../ambler.ts";
import { AzkLinkInput } from "../utils/db.ts";
import { Note, readNote as fsReadNote } from "../utils/fs.ts";

export interface State {
  // Populated upstream by LINK_INPUT — always set by the time this runs.
  fromId?: string;
  toId?: string;
  relation?: string;
  note?: Note;
  links?: AzkLinkInput[];
  error?: string;
}

export type Edge = "onValid" | "onError";

export type Utils = {
  readNote: (id: string) => Promise<Note | null>;
  now: () => string;
  print: (msg: string) => void;
};

const defaultUtils: Utils = {
  readNote: (id) => fsReadNote(id),
  now: () => new Date().toISOString(),
  print: (msg) => console.log(msg),
};

/**
 * Requires both ends of the link to already exist — unlike `create`'s `links`
 * input, which is not validated — then appends the link to the source note's
 * frontmatter for the write and index steps that follow. If either id is
 * missing, prints `{ error }` and takes the `onError` edge; the process still
 * exits 0 unless the caller maps that edge to an explicit non-zero exit.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
async (state) => {
  const { fromId, toId, relation } = state;

  const [fromNote, toNote] = await Promise.all([
    utils.readNote(fromId!),
    utils.readNote(toId!),
  ]);

  if (!fromNote || !toNote) {
    const error =
      `Cannot link: one or both azk entries not found (${fromId}, ${toId})`;
    utils.print(JSON.stringify({ error }));
    return [edges.onError, { ...state, error }];
  }

  const note: Note = {
    ...fromNote,
    links: [...fromNote.links, { to: toId!, relation: relation! }],
    updated: utils.now(),
  };

  return [edges.onValid, {
    ...state,
    note,
    links: [{ toId: toId!, relation: relation! }],
  }];
};
