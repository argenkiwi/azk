import { NodeFactory } from "../ambler.ts";
import { AzkLinkInput } from "../utils/db.ts";
import { readStdinJson } from "../utils/stdin.ts";

export interface State {
  title?: string;
  body?: string;
  tags?: string[];
  links?: AzkLinkInput[];
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
 * Reads `{ title, body, tags?, links? }` as JSON on stdin. Both malformed
 * JSON and a missing `title`/`body` take the `onInvalid` edge carrying the
 * message to print — the walk decides that this is a usage failure and exits
 * non-zero, not the node.
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

  if (!input?.title || !input?.body) {
    return [edges.onInvalid, {
      ...state,
      usage: JSON.stringify({ error: "title and body are required" }),
    }];
  }

  return [edges.onParsed, {
    ...state,
    title: input.title,
    body: input.body,
    tags: input.tags ?? [],
    links: input.links ?? [],
  }];
};
