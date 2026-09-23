import { ambler } from "../ambler.ts";
import defer * as linkInputNode from "../nodes/link-input.ts";
import defer * as linkValidateNode from "../nodes/link-validate.ts";
import defer * as writeNoteNode from "../nodes/write-note.ts";
import defer * as createLinksNode from "../nodes/create-links.ts";
import defer * as linkFinishNode from "../nodes/link-finish.ts";
import defer * as usageNode from "../nodes/usage.ts";
import { AzkLinkInput } from "../utils/db.ts";
import { Note } from "../utils/fs.ts";

export interface State {
  args: string[];
  usage?: string;
  error?: string;

  fromId?: string;
  toId?: string;
  relation?: string;
  /** The source note, with the new link appended to its frontmatter. */
  note?: Note;
  /** The same link in caller form, for the index's link graph. */
  links?: AzkLinkInput[];
}

type NodeId =
  | "INPUT"
  | "VALIDATE"
  | "WRITE_NOTE"
  | "CREATE_LINKS"
  | "FINISH"
  | "USAGE";

const amble = ambler<State, NodeId>({
  INPUT: () =>
    linkInputNode.factory({ onParsed: "VALIDATE", onMissing: "USAGE" }),
  // Unlike create's links, both ends must already exist.
  VALIDATE: () =>
    linkValidateNode.factory({ onValid: "WRITE_NOTE", onError: null }),
  // link deliberately doesn't re-index the note it touches, matching the
  // behaviour azk has always had: only the link graph and the file change.
  WRITE_NOTE: () =>
    writeNoteNode.factory({ onWritten: "CREATE_LINKS", onError: null }),
  CREATE_LINKS: () =>
    createLinksNode.factory({ onDone: "FINISH", onError: null }),
  FINISH: () => linkFinishNode.factory({ onLinked: null }),
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
