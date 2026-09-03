import { ambler, Node } from "../ambler.ts";
import defer * as getNode from "../nodes/get.ts";

export interface State {
  id: string;
  result?: unknown;
  error?: string;
}

type NodeId = "GET";

const amble = ambler<State, NodeId>({
  GET: () =>
    getNode.factory({ onFound: null, onNotFound: null }) as unknown as Node<State, NodeId>,
});

export async function main(argv: string[]): Promise<void> {
  const id = argv[0];
  if (!id) {
    console.error("Usage: azk get <id>");
    Deno.exit(1);
  }

  let nodeId: NodeId | null = "GET";
  let state: State = { id };

  while (nodeId) {
    const next = amble(nodeId, state);
    [nodeId, state] = next instanceof Promise ? await next : next;
  }
}

if (import.meta.main) {
  await main(Deno.args);
}
