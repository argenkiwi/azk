import { ambler } from "../ambler.ts";
import defer * as reindexListNode from "../nodes/reindex-list.ts";
import defer * as reindexNextNode from "../nodes/reindex-next.ts";
import defer * as reindexDetectChangeNode from "../nodes/reindex-detect-change.ts";
import defer * as embedNode from "../nodes/embed.ts";
import defer * as indexUpsertNode from "../nodes/index-upsert.ts";
import defer * as reindexReplaceLinksNode from "../nodes/reindex-replace-links.ts";
import defer * as reindexPruneOrphansNode from "../nodes/reindex-prune-orphans.ts";
import defer * as reindexFinishNode from "../nodes/reindex-finish.ts";
import { Note } from "../utils/fs.ts";

/**
 * `reindex` takes no arguments, so nothing is seeded and it is the one verb
 * with no bad invocation to report — hence no USAGE node and no `usage` field.
 */
export interface State {
  error?: string;

  /** The queue: every note on disk, and the ones still to process. */
  allIds?: string[];
  remainingIds?: string[];
  /** The loop's cursor, and the note it currently points at. */
  id?: string;
  note?: Note;
  textToEmbed?: string;
  embedding?: number[] | null;

  indexed?: number;
  updated?: number;
  removed?: number;
  total?: number;
}

type NodeId =
  | "LIST"
  | "NEXT"
  | "DETECT_CHANGE"
  | "EMBED"
  | "INDEX_UPSERT"
  | "REPLACE_LINKS"
  | "PRUNE_ORPHANS"
  | "FINISH";

const amble = ambler<State, NodeId>({
  LIST: () => reindexListNode.factory({ onListed: "NEXT" }),
  // The only node that decides how long the reindex runs.
  NEXT: () =>
    reindexNextNode.factory({
      onNext: "DETECT_CHANGE",
      onDone: "PRUNE_ORPHANS",
    }),
  DETECT_CHANGE: () =>
    reindexDetectChangeNode.factory({
      onChecked: "EMBED",
      // The file vanished between listing and reading it.
      onMissing: "NEXT",
    }),
  EMBED: () => embedNode.factory({ onEmbedded: "INDEX_UPSERT" }),
  // A failure here skips this note and moves on to the next queued id.
  INDEX_UPSERT: () =>
    indexUpsertNode.factory({ onIndexed: "REPLACE_LINKS", onError: "NEXT" }),
  REPLACE_LINKS: () => reindexReplaceLinksNode.factory({ onReplaced: "NEXT" }),
  PRUNE_ORPHANS: () => reindexPruneOrphansNode.factory({ onPruned: "FINISH" }),
  FINISH: () => reindexFinishNode.factory({ onIndexed: null }),
});

export async function main(_argv: string[]): Promise<void> {
  let nodeId: NodeId | null = "LIST";
  let state: State = {};

  while (nodeId) {
    const next = amble(nodeId, state);
    [nodeId, state] = next instanceof Promise ? await next : next;
  }
}

if (import.meta.main) {
  await main(Deno.args);
}
