import { ambler, Node } from "../ambler.ts";
import defer * as deleteNode from "../nodes/delete.ts";

export interface State {
  id: string;
  result?: unknown;
  error?: string;
}

type NodeId = "DELETE";

const amble = ambler<State, NodeId>({
  DELETE: () =>
    deleteNode.factory({ onDeleted: null, onNotFound: null }) as unknown as Node<State, NodeId>,
});

export async function main(argv: string[]): Promise<void> {
  const id = argv[0];
  if (!id) {
    console.error("Usage: azk delete <id>");
    Deno.exit(1);
  }

  let nodeId: NodeId | null = "DELETE";
  let state: State = { id };

  while (nodeId) {
    const next = amble(nodeId, state);
    [nodeId, state] = next instanceof Promise ? await next : next;
  }
}

if (import.meta.main) {
  await main(Deno.args);
}
