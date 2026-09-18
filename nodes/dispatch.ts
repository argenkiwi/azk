import { NodeFactory } from "../ambler.ts";

/** Printed when the command line names no verb, or one azk doesn't have. */
const USAGE = `Usage: azk <verb> [args]

Verbs:
  search <query> [limit]
  create (reads JSON from stdin)
  get <id>
  update <id> (reads JSON from stdin)
  delete <id>
  link <fromId> <toId> <relation>
  reindex`;

export interface State {
  argv: string[];
  verb?: string;
  args?: string[];
  usage?: string;
}

export type Edge =
  | "onSearch"
  | "onCreate"
  | "onGet"
  | "onUpdate"
  | "onDelete"
  | "onLink"
  | "onReindex"
  | "onUnknown";

/**
 * Entry node: reads the verb off the command line and hands the rest of the
 * arguments to that verb's chain. Its edges name a classification rather than
 * an event, which is the one deliberate exception to the `onPastTense` rule.
 *
 * An unrecognised verb carries the full usage block on `usage`, so the walk
 * terminates through `USAGE` and exits non-zero like every other bad
 * invocation.
 */
export const factory: NodeFactory<State, Edge> = (edges) => (state) => {
  const [verb, ...args] = state.argv;

  const edge: Record<string, Edge> = {
    search: "onSearch",
    create: "onCreate",
    get: "onGet",
    update: "onUpdate",
    delete: "onDelete",
    link: "onLink",
    reindex: "onReindex",
  };

  const matched = verb ? edge[verb.toLowerCase()] : undefined;

  if (!matched) return [edges.onUnknown, { ...state, usage: USAGE }];

  return [edges[matched], { ...state, verb: verb.toLowerCase(), args }];
};
