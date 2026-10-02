import { NodeFactory } from "../ambler.ts";
import { VERB_GUIDES } from "../utils/help.ts";

export interface State {
  // Populated upstream by DISPATCH — the verb's arguments, verb removed.
  args?: string[];
  topic?: string;
  usage?: string;
}

export type Edge = "onParsed" | "onUnknown";

/**
 * Resolves which guide to print: the general one when no verb is named,
 * otherwise that verb's. A verb azk doesn't have is a bad invocation, and its
 * usage line lists the ones it does.
 */
export const factory: NodeFactory<State, Edge> = (edges) => (state) => {
  const verb = state.args?.[0]?.toLowerCase();

  if (!verb) return [edges.onParsed, { ...state, topic: "general" }];

  if (!Object.hasOwn(VERB_GUIDES, verb)) {
    return [edges.onUnknown, {
      ...state,
      usage: `Usage: azk help [verb]\n\nVerbs: ${
        Object.keys(VERB_GUIDES).join(", ")
      }`,
    }];
  }

  return [edges.onParsed, { ...state, topic: verb }];
};
