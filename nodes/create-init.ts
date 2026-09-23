import { NodeFactory } from "../ambler.ts";
import { AzkLinkInput } from "../utils/db.ts";
import { Note } from "../utils/fs.ts";

export interface State {
  // Populated upstream by CREATE_INPUT — always set by the time this runs.
  title?: string;
  body?: string;
  tags?: string[];
  links?: AzkLinkInput[];
  note?: Note;
  fromId?: string;
  textToEmbed?: string;
}

export type Edge = "onReady";

export type Utils = {
  generateId: () => string;
  now: () => string;
};

function generateTimestampId(): string {
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, "").slice(
    0,
    17,
  );
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 4);
  return `${timestamp}${suffix}`;
}

const defaultUtils: Utils = {
  generateId: generateTimestampId,
  now: () => new Date().toISOString(),
};

/**
 * Assembles the new note in memory: a fresh id, matching created/updated
 * timestamps, and the caller's links translated into frontmatter form. The id
 * and timestamps live inside `note` rather than beside it, so nothing further
 * downstream has to keep them in step.
 *
 * Note: `links` are not validated against existing ids here (unlike the
 * `link` subcommand) — a `toId` that doesn't exist becomes a dangling link,
 * and `reindex` won't catch it either.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
(state) => {
  const id = utils.generateId();
  const timestamp = utils.now();

  const note: Note = {
    id,
    title: state.title!,
    tags: state.tags ?? [],
    created: timestamp,
    updated: timestamp,
    links: (state.links ?? []).map((link) => ({
      to: link.toId,
      relation: link.relation,
    })),
    body: state.body!,
  };

  return [edges.onReady, {
    ...state,
    note,
    fromId: id,
    textToEmbed: state.body,
  }];
};
