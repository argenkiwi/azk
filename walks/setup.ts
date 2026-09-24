import { ambler } from "../ambler.ts";
import defer * as setupGitignoreNode from "../nodes/setup-gitignore.ts";
import defer * as setupHooksNode from "../nodes/setup-hooks.ts";
import defer * as setupIndexCheckNode from "../nodes/setup-index-check.ts";
import defer * as reindexListNode from "../nodes/reindex-list.ts";
import defer * as reindexNextNode from "../nodes/reindex-next.ts";
import defer * as reindexDetectChangeNode from "../nodes/reindex-detect-change.ts";
import defer * as embedNode from "../nodes/embed.ts";
import defer * as indexUpsertNode from "../nodes/index-upsert.ts";
import defer * as reindexReplaceLinksNode from "../nodes/reindex-replace-links.ts";
import defer * as reindexPruneOrphansNode from "../nodes/reindex-prune-orphans.ts";
import defer * as setupFinishNode from "../nodes/setup-finish.ts";
import type { HookStatus } from "../nodes/setup-hooks.ts";
import { Note } from "../utils/fs.ts";

/**
 * `setup` takes no arguments, so like `reindex` nothing is seeded and there
 * is no USAGE node. The reindex fields are here because the walk runs the
 * reindex chain when the project has no index yet.
 */
export interface State {
  error?: string;

  gitignore?: "added" | "present";
  hooks?: Record<string, HookStatus> | "skipped";

  allIds?: string[];
  remainingIds?: string[];
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
  | "GITIGNORE"
  | "HOOKS"
  | "INDEX_CHECK"
  | "LIST"
  | "NEXT"
  | "DETECT_CHANGE"
  | "EMBED"
  | "INDEX_UPSERT"
  | "REPLACE_LINKS"
  | "PRUNE_ORPHANS"
  | "FINISH";

const amble = ambler<State, NodeId>({
  GITIGNORE: () => setupGitignoreNode.factory({ onDone: "HOOKS" }),
  HOOKS: () => setupHooksNode.factory({ onDone: "INDEX_CHECK" }),
  INDEX_CHECK: () =>
    setupIndexCheckNode.factory({ onMissing: "LIST", onPresent: "FINISH" }),
  // The reindex chain, as wired in walks/reindex.ts, except that it ends at
  // setup's own FINISH so the run prints one JSON value, not two.
  LIST: () => reindexListNode.factory({ onListed: "NEXT" }),
  NEXT: () =>
    reindexNextNode.factory({
      onNext: "DETECT_CHANGE",
      onDone: "PRUNE_ORPHANS",
    }),
  DETECT_CHANGE: () =>
    reindexDetectChangeNode.factory({
      onChecked: "EMBED",
      onMissing: "NEXT",
    }),
  EMBED: () => embedNode.factory({ onEmbedded: "INDEX_UPSERT" }),
  INDEX_UPSERT: () =>
    indexUpsertNode.factory({ onIndexed: "REPLACE_LINKS", onError: "NEXT" }),
  REPLACE_LINKS: () => reindexReplaceLinksNode.factory({ onReplaced: "NEXT" }),
  PRUNE_ORPHANS: () => reindexPruneOrphansNode.factory({ onPruned: "FINISH" }),
  FINISH: () => setupFinishNode.factory({ onDone: null }),
});

export async function main(_argv: string[]): Promise<void> {
  let nodeId: NodeId | null = "GITIGNORE";
  let state: State = {};

  while (nodeId) {
    const next = amble(nodeId, state);
    [nodeId, state] = next instanceof Promise ? await next : next;
  }
}

if (import.meta.main) {
  await main(Deno.args);
}
