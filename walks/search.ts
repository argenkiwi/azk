import { ambler } from "../ambler.ts";
import defer * as searchInputNode from "../nodes/search-input.ts";
import defer * as searchKeywordNode from "../nodes/search-keyword.ts";
import defer * as embedNode from "../nodes/embed.ts";
import defer * as searchSemanticNode from "../nodes/search-semantic.ts";
import defer * as searchMergeRankNode from "../nodes/search-merge-rank.ts";
import defer * as usageNode from "../nodes/usage.ts";
import { RankedAzk } from "../utils/db.ts";

/**
 * `args` is required because the walk seeds it; everything else is filled in
 * by a node upstream of whoever reads it.
 */
export interface State {
  args: string[];
  usage?: string;

  query?: string;
  limit?: number;
  textToEmbed?: string;
  embedding?: number[] | null;
  keywordResults?: RankedAzk[];
  semanticResults?: RankedAzk[];
}

type NodeId =
  | "INPUT"
  | "KEYWORD"
  | "EMBED"
  | "SEMANTIC"
  | "MERGE_RANK"
  | "USAGE";

const amble = ambler<State, NodeId>({
  INPUT: () =>
    searchInputNode.factory({ onParsed: "KEYWORD", onMissing: "USAGE" }),
  KEYWORD: () => searchKeywordNode.factory({ onSearched: "EMBED" }),
  EMBED: () => embedNode.factory({ onEmbedded: "SEMANTIC" }),
  SEMANTIC: () => searchSemanticNode.factory({ onScored: "MERGE_RANK" }),
  // An empty result set is not an error: it prints `[]` and exits 0.
  MERGE_RANK: () =>
    searchMergeRankNode.factory({ onFound: null, onEmpty: null }),
  USAGE: () => usageNode.factory({ onExplained: null }),
});

export async function main(argv: string[]): Promise<void> {
  let nodeId: NodeId | null = "INPUT";
  let state: State = { args: argv };

  while (nodeId) {
    const next = amble(nodeId, state);
    [nodeId, state] = next instanceof Promise ? await next : next;
  }

  if (state.usage) Deno.exit(1);
}

if (import.meta.main) {
  await main(Deno.args);
}
