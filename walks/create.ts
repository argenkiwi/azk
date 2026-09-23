import { ambler } from "../ambler.ts";
import defer * as createInputNode from "../nodes/create-input.ts";
import defer * as createInitNode from "../nodes/create-init.ts";
import defer * as embedNode from "../nodes/embed.ts";
import defer * as writeNoteNode from "../nodes/write-note.ts";
import defer * as indexUpsertNode from "../nodes/index-upsert.ts";
import defer * as createLinksNode from "../nodes/create-links.ts";
import defer * as createFinishNode from "../nodes/create-finish.ts";
import defer * as usageNode from "../nodes/usage.ts";
import { AzkLinkInput } from "../utils/db.ts";
import { Note } from "../utils/fs.ts";

/**
 * `create` takes no arguments — its whole input is JSON on stdin — so nothing
 * is seeded and every field is filled in by a node upstream of its reader.
 */
export interface State {
  usage?: string;
  error?: string;

  title?: string;
  body?: string;
  tags?: string[];
  /** Caller-supplied `{ toId, relation }`, never a note's own frontmatter form. */
  links?: AzkLinkInput[];
  /** The new note's id, set by INIT for LINKS to point the links out of. */
  fromId?: string;
  note?: Note;
  textToEmbed?: string;
  embedding?: number[] | null;
}

type NodeId =
  | "INPUT"
  | "INIT"
  | "EMBED"
  | "WRITE_NOTE"
  | "INDEX_UPSERT"
  | "LINKS"
  | "FINISH"
  | "USAGE";

const amble = ambler<State, NodeId>({
  INPUT: () =>
    createInputNode.factory({ onParsed: "INIT", onInvalid: "USAGE" }),
  INIT: () => createInitNode.factory({ onReady: "EMBED" }),
  EMBED: () => embedNode.factory({ onEmbedded: "WRITE_NOTE" }),
  // The Markdown file is the source of truth, so it is written before the
  // derived index is touched.
  WRITE_NOTE: () =>
    writeNoteNode.factory({ onWritten: "INDEX_UPSERT", onError: null }),
  INDEX_UPSERT: () =>
    indexUpsertNode.factory({ onIndexed: "LINKS", onError: null }),
  LINKS: () => createLinksNode.factory({ onDone: "FINISH", onError: null }),
  FINISH: () => createFinishNode.factory({ onCreated: null }),
  USAGE: () => usageNode.factory({ onExplained: null }),
});

export async function main(_argv: string[]): Promise<void> {
  let nodeId: NodeId | null = "INPUT";
  let state: State = {};

  while (nodeId) {
    const next = amble(nodeId, state);
    [nodeId, state] = next instanceof Promise ? await next : next;
  }

  if (state.usage) Deno.exit(1);
}

if (import.meta.main) {
  await main(Deno.args);
}
