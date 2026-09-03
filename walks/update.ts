import { ambler } from "../ambler.ts";
import defer * as updateNode from "../nodes/update.ts";
import { readStdinJson } from "../utils/stdin.ts";

export interface State {
  id: string;
  title?: string;
  body?: string;
  tags?: string[];
  result?: { id: string; updated: true };
  error?: string;
}

type NodeId = "UPDATE";

const amble = ambler<State, NodeId>({
  UPDATE: () => updateNode.factory({ onUpdated: null, onNotFound: null }),
});

export async function main(argv: string[]): Promise<void> {
  const id = argv[0];
  if (!id) {
    console.error('Usage: echo \'{"title":"..."}\' | azk update <id>');
    Deno.exit(1);
  }

  const input = await readStdinJson<{
    title?: string;
    body?: string;
    tags?: string[];
  }>();

  let nodeId: NodeId | null = "UPDATE";
  let state: State = { id, ...input };

  while (nodeId) {
    const next = amble(nodeId, state);
    [nodeId, state] = next instanceof Promise ? await next : next;
  }
}

if (import.meta.main) {
  await main(Deno.args);
}
