import { ambler, Node } from "../ambler.ts";
import defer * as createNode from "../nodes/create.ts";
import { readStdinJson } from "../utils/stdin.ts";

export interface State {
  title: string;
  body: string;
  tags: string[];
  links?: { toId: string; relation: string }[];
  result?: unknown;
  error?: string;
}

type NodeId = "CREATE";

const amble = ambler<State, NodeId>({
  CREATE: () =>
    createNode.factory({ onCreated: null, onError: null }) as unknown as Node<State, NodeId>,
});

export async function main(_argv: string[]): Promise<void> {
  const input = await readStdinJson<{
    title: string;
    body: string;
    tags?: string[];
    links?: { toId: string; relation: string }[];
  }>();

  if (!input.title || !input.body) {
    console.error(JSON.stringify({ error: "title and body are required" }));
    Deno.exit(1);
  }

  let nodeId: NodeId | null = "CREATE";
  let state: State = {
    title: input.title,
    body: input.body,
    tags: input.tags ?? [],
    links: input.links,
  };

  while (nodeId) {
    const next = amble(nodeId, state);
    [nodeId, state] = next instanceof Promise ? await next : next;
  }
}

if (import.meta.main) {
  await main(Deno.args);
}
