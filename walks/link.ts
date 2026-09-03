import { ambler, Node } from "../ambler.ts";
import defer * as linkNode from "../nodes/link.ts";

export interface State {
  fromId: string;
  toId: string;
  relation: string;
  result?: unknown;
  error?: string;
}

type NodeId = "LINK";

const amble = ambler<State, NodeId>({
  LINK: () =>
    linkNode.factory({ onLinked: null, onError: null }) as unknown as Node<State, NodeId>,
});

export async function main(argv: string[]): Promise<void> {
  const [fromId, toId, relation] = argv;
  if (!fromId || !toId || !relation) {
    console.error('Usage: azk link <fromId> <toId> "<relation>"');
    Deno.exit(1);
  }

  let nodeId: NodeId | null = "LINK";
  let state: State = { fromId, toId, relation };

  while (nodeId) {
    const next = amble(nodeId, state);
    [nodeId, state] = next instanceof Promise ? await next : next;
  }
}

if (import.meta.main) {
  await main(Deno.args);
}
