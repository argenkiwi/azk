import { NodeFactory } from "../ambler.ts";
import { GENERAL, VERB_GUIDES } from "../utils/help.ts";

export interface State {
  // Set by HELP_INPUT: "general", or a verb that has a guide.
  topic?: string;
}

export type Edge = "onPrinted";

export type Utils = {
  print: (msg: string) => void;
};

const defaultUtils: Utils = {
  print: (msg) => console.log(msg),
};

/**
 * Prints the resolved guide. Unlike every other verb's output this is plain
 * Markdown, not JSON — it is documentation meant to be read, and escaping it
 * into a JSON string would only get in the way.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
(state) => {
  utils.print(
    state.topic === "general" ? GENERAL : VERB_GUIDES[state.topic!],
  );
  return [edges.onPrinted, state];
};
