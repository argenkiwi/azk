import { ambler } from "../ambler.ts";
import { runWalk } from "../walk.ts";
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
  await runWalk(amble, "REINDEX", {});
}

if (import.meta.main) {
  await main(Deno.args);
}
