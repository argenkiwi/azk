import { ambler } from "../ambler.ts";
import defer * as idArgNode from "../nodes/id-arg.ts";
import defer * as existsCheckNode from "../nodes/exists-check.ts";
import defer * as getNode from "../nodes/get.ts";
import defer * as usageNode from "../nodes/usage.ts";
import { Note } from "../utils/fs.ts";

/**
 * `verb` is seeded alongside `args` because ID_ARG builds its usage line from
 * it — the one node shared by `get`, `update` and `delete`.
 */
export interface State {
  verb: string;
  args: string[];
  usage?: string;
  error?: string;

  id?: string;
  note?: Note;
}

type NodeId = "ID_ARG" | "EXISTS_CHECK" | "GET" | "USAGE";

const amble = ambler<State, NodeId>({
  ID_ARG: () =>
    idArgNode.factory({ onParsed: "EXISTS_CHECK", onMissing: "USAGE" }),
  // A missing note prints `{ error }` and exits 0 — it's a failure inside the
  // verb, not a bad invocation.
  EXISTS_CHECK: () =>
    existsCheckNode.factory({ onFound: "GET", onNotFound: null }),
  GET: () => getNode.factory({ onFound: null }),
  USAGE: () => usageNode.factory({ onExplained: null }),
});

export async function main(argv: string[]): Promise<void> {
  let nodeId: NodeId | null = "ID_ARG";
  let state: State = { verb: "get", args: argv };

  while (nodeId) {
    const next = amble(nodeId, state);
    [nodeId, state] = next instanceof Promise ? await next : next;
  }

  if (state.usage) Deno.exit(1);
}

if (import.meta.main) {
  await main(Deno.args);
}
