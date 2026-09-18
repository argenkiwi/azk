import { NodeFactory } from "../ambler.ts";
import { readStdinJson } from "../utils/stdin.ts";

export interface State {
  title?: string;
  body?: string;
  tags?: string[];
  usage?: string;
}

export type Edge = "onParsed" | "onInvalid";

export type Utils = {
  readStdinJson: () => Promise<unknown>;
};

const defaultUtils: Utils = {
  readStdinJson: () => readStdinJson<unknown>(),
};

/**
 * Reads a partial `{ title?, body?, tags? }` as JSON on stdin. Every field is
 * optional — an empty object is a valid no-op update — so only malformed JSON
 * takes the `onInvalid` edge.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
async (state) => {
  let input: Partial<State>;

  try {
    input = await utils.readStdinJson() as Partial<State>;
  } catch {
    return [edges.onInvalid, {
      ...state,
      usage: JSON.stringify({ error: "invalid JSON on stdin" }),
    }];
  }

  return [edges.onParsed, {
    ...state,
    title: input?.title,
    body: input?.body,
    tags: input?.tags,
  }];
};
