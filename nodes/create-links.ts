import { NodeFactory } from "../ambler.ts";
import { AzkLinkInput, createLink as dbCreateLink } from "../utils/db.ts";
import { DB_PATH } from "../utils/config.ts";

export interface State {
  // Populated upstream (CREATE_INIT or LINK_VALIDATE) — always set by the
  // time this node runs.
  fromId?: string;
  links?: AzkLinkInput[];
  error?: string;
}

export type Edge = "onDone" | "onError";

export type Utils = {
  createLink: (fromId: string, toId: string, relation: string) => void;
  print: (msg: string) => void;
};

const defaultUtils: Utils = {
  createLink: (fromId, toId, relation) =>
    dbCreateLink(DB_PATH, fromId, toId, relation),
  print: (msg) => console.log(msg),
};

/**
 * Records `state.links` in the index's link graph, all pointing out of
 * `state.fromId`. Nothing to link is not an error — it just takes `onDone`
 * without touching the database. On failure, prints `{ error }` and takes the
 * `onError` edge; the process still exits 0 unless the caller maps that edge
 * to an explicit non-zero exit.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
(state) => {
  try {
    for (const link of state.links ?? []) {
      utils.createLink(state.fromId!, link.toId, link.relation);
    }

    return [edges.onDone, state];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    utils.print(JSON.stringify({ error: message }));
    return [edges.onError, { ...state, error: message }];
  }
};
