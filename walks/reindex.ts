import { ambler } from "../ambler.ts";
import defer * as reindexNode from "../nodes/reindex.ts";

export interface State {
  result?: { indexed: number; updated: number; removed: number; total: number };
  error?: string;
}

type NodeId = "REINDEX";

const amble = ambler<State, NodeId>({
  REINDEX: () => reindexNode.factory({ onIndexed: null }),
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
