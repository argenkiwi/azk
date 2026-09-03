import { ambler } from "../ambler.ts";
import defer * as searchNode from "../nodes/search.ts";
import { RankedAzk } from "../nodes/search.ts";

export interface State {
  query: string;
  limit?: number;
  results?: RankedAzk[];
  error?: string;
}

type NodeId = "SEARCH";

const amble = ambler<State, NodeId>({
  SEARCH: () => searchNode.factory({ onFound: null, onEmpty: null }),
});

export async function main(argv: string[]): Promise<void> {
  const query = argv[0];
  const limit = argv[1] ? Number(argv[1]) : undefined;
  if (!query) {
    console.error('Usage: azk search "<query>" [limit]');
    Deno.exit(1);
  }

  let nodeId: NodeId | null = "SEARCH";
  let state: State = { query, limit };

  while (nodeId) {
    const next = amble(nodeId, state);
    [nodeId, state] = next instanceof Promise ? await next : next;
  }
}

if (import.meta.main) {
  await main(Deno.args);
}
