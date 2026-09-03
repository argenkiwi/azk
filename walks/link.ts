import { ambler } from "../ambler.ts";
import { runWalk } from "../walk.ts";
import { usageExit } from "../utils/cli.ts";
import defer * as linkNode from "../nodes/link.ts";

export interface State {
  fromId: string;
  toId: string;
  relation: string;
  result?: { fromId: string; toId: string; relation: string; linked: true };
  error?: string;
}

type NodeId = "LINK";

const amble = ambler<State, NodeId>({
  LINK: () => linkNode.factory({ onLinked: null, onError: null }),
});

export async function main(argv: string[]): Promise<void> {
  const [fromId, toId, relation] = argv;
  if (!fromId || !toId || !relation) {
    usageExit('Usage: azk link <fromId> <toId> "<relation>"');
  }

  const state = await runWalk(amble, "LINK", { fromId, toId, relation });
  if (state.error) Deno.exit(1);
}

if (import.meta.main) {
  await main(Deno.args);
}
