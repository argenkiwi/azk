import { ambler } from "../ambler.ts";
import defer * as helpInputNode from "../nodes/help-input.ts";
import defer * as helpPrintNode from "../nodes/help-print.ts";
import defer * as usageNode from "../nodes/usage.ts";

/**
 * `args` is required because the walk seeds it; `topic` is resolved by INPUT
 * so PRINT never has to know which verbs exist.
 */
export interface State {
  args: string[];
  usage?: string;

  topic?: string;
}

type NodeId = "INPUT" | "PRINT" | "USAGE";

const amble = ambler<State, NodeId>({
  INPUT: () => helpInputNode.factory({ onParsed: "PRINT", onUnknown: "USAGE" }),
  PRINT: () => helpPrintNode.factory({ onPrinted: null }),
  USAGE: () => usageNode.factory({ onExplained: null }),
});

export async function main(argv: string[]): Promise<void> {
  let nodeId: NodeId | null = "INPUT";
  let state: State = { args: argv };

  while (nodeId) {
    const next = amble(nodeId, state);
    [nodeId, state] = next instanceof Promise ? await next : next;
  }

  if (state.usage) Deno.exit(1);
}

if (import.meta.main) {
  await main(Deno.args);
}
