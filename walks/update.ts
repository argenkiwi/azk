import { ambler } from "../ambler.ts";
import defer * as idArgNode from "../nodes/id-arg.ts";
import defer * as updateInputNode from "../nodes/update-input.ts";
import defer * as existsCheckNode from "../nodes/exists-check.ts";
import defer * as updateMergeNode from "../nodes/update-merge.ts";
import defer * as embedNode from "../nodes/embed.ts";
import defer * as writeNoteNode from "../nodes/write-note.ts";
import defer * as indexUpsertNode from "../nodes/index-upsert.ts";
import defer * as updateFinishNode from "../nodes/update-finish.ts";
import defer * as usageNode from "../nodes/usage.ts";
import { Note } from "../utils/fs.ts";

/**
 * `verb` is seeded alongside `args` because ID_ARG builds its usage line from
 * it — the one node shared by `get`, `update` and `delete`.
 */
export interface State {
  verb: string;
  args: string[];
  usage?: string;
  error?: string;

  id?: string;
  title?: string;
  body?: string;
  tags?: string[];
  note?: Note;
  textToEmbed?: string;
  embedding?: number[] | null;
}

type NodeId =
  | "ID_ARG"
  | "INPUT"
  | "EXISTS_CHECK"
  | "MERGE"
  | "EMBED"
  | "WRITE_NOTE"
  | "INDEX_UPSERT"
  | "FINISH"
  | "USAGE";

const amble = ambler<State, NodeId>({
  ID_ARG: () =>
    idArgNode.factory(
      { onParsed: "INPUT", onMissing: "USAGE" },
      // update reads stdin as well as an id, so it says so.
      { usage: () => `Usage: echo '{"title":"..."}' | azk update <id>` },
    ),
  INPUT: () =>
    updateInputNode.factory({
      onParsed: "EXISTS_CHECK",
      onInvalid: "USAGE",
    }),
  EXISTS_CHECK: () =>
    existsCheckNode.factory({ onFound: "MERGE", onNotFound: null }),
  MERGE: () => updateMergeNode.factory({ onMerged: "EMBED" }),
  EMBED: () => embedNode.factory({ onEmbedded: "WRITE_NOTE" }),
  WRITE_NOTE: () =>
    writeNoteNode.factory({ onWritten: "INDEX_UPSERT", onError: null }),
  INDEX_UPSERT: () =>
    indexUpsertNode.factory({ onIndexed: "FINISH", onError: null }),
  FINISH: () => updateFinishNode.factory({ onUpdated: null }),
  USAGE: () => usageNode.factory({ onExplained: null }),
});

export async function main(argv: string[]): Promise<void> {
  let nodeId: NodeId | null = "ID_ARG";
  let state: State = { verb: "update", args: argv };

  while (nodeId) {
    const next = amble(nodeId, state);
    [nodeId, state] = next instanceof Promise ? await next : next;
  }

  if (state.usage) Deno.exit(1);
}

if (import.meta.main) {
  await main(Deno.args);
}
