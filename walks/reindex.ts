import { ambler, Node } from "../ambler.ts";
import defer * as reindexNode from "../nodes/reindex.ts";

export interface State {
  result?: unknown;
  error?: string;
}

type NodeId = "REINDEX";

const amble = ambler<State, NodeId>({
  REINDEX: () =>
    reindexNode.factory({ onIndexed: null }) as unknown as Node<State, NodeId>,
});

export async function main(_argv: string[]): Promise<void> {
  let nodeId: NodeId | null = "REINDEX";
  let state: State = {};

  while (nodeId) {
    const next = amble(nodeId, state);
    [nodeId, state] = next instanceof Promise ? await next : next;
  }
}

if (import.meta.main) {
  await main(Deno.args);
}
