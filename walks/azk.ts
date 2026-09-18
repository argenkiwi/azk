import { ambler } from "../ambler.ts";
import defer * as dispatchNode from "../nodes/dispatch.ts";
import defer * as usageNode from "../nodes/usage.ts";
import defer * as idArgNode from "../nodes/id-arg.ts";
import defer * as existsCheckNode from "../nodes/exists-check.ts";
import defer * as embedNode from "../nodes/embed.ts";
import defer * as writeNoteNode from "../nodes/write-note.ts";
import defer * as indexUpsertNode from "../nodes/index-upsert.ts";
import defer * as createLinksNode from "../nodes/create-links.ts";
import defer * as searchInputNode from "../nodes/search-input.ts";
import defer * as searchKeywordNode from "../nodes/search-keyword.ts";
import defer * as searchSemanticNode from "../nodes/search-semantic.ts";
import defer * as searchMergeRankNode from "../nodes/search-merge-rank.ts";
import defer * as createInputNode from "../nodes/create-input.ts";
import defer * as createInitNode from "../nodes/create-init.ts";
import defer * as createFinishNode from "../nodes/create-finish.ts";
import defer * as getNode from "../nodes/get.ts";
import defer * as updateInputNode from "../nodes/update-input.ts";
import defer * as updateMergeNode from "../nodes/update-merge.ts";
import defer * as updateFinishNode from "../nodes/update-finish.ts";
import defer * as deleteNode from "../nodes/delete.ts";
import defer * as linkInputNode from "../nodes/link-input.ts";
import defer * as linkValidateNode from "../nodes/link-validate.ts";
import defer * as linkFinishNode from "../nodes/link-finish.ts";
import defer * as reindexListNode from "../nodes/reindex-list.ts";
import defer * as reindexNextNode from "../nodes/reindex-next.ts";
import defer * as reindexDetectChangeNode from "../nodes/reindex-detect-change.ts";
import defer * as reindexReplaceLinksNode from "../nodes/reindex-replace-links.ts";
import defer * as reindexPruneOrphansNode from "../nodes/reindex-prune-orphans.ts";
import defer * as reindexFinishNode from "../nodes/reindex-finish.ts";
import { AzkLinkInput, RankedAzk } from "../utils/db.ts";
import { Note } from "../utils/fs.ts";

/**
 * One state shared by every subcommand. `argv` is the only required field —
 * the rule is that a field is required only if every verb sets it before any
 * node reads it, and nothing else qualifies. Each node declares just the
 * fields it touches and this type must stay a structural supertype of all of
 * them, so a node that made one of these required would no longer wire in.
 */
export interface State {
  argv: string[];
  verb?: string;
  args?: string[];
  usage?: string;
  error?: string;

  /** The note being worked on, and the pipeline that persists it. */
  id?: string;
  note?: Note;
  textToEmbed?: string;
  embedding?: number[] | null;
  /** Source of the links in `links` — the note they point out of. */
  fromId?: string;
  /** Always caller-supplied `{ toId, relation }`, never a note's own `{ to, relation }`. */
  links?: AzkLinkInput[];

  /** create / update input. */
  title?: string;
  body?: string;
  tags?: string[];

  /** link input. */
  toId?: string;
  relation?: string;

  /** search input and intermediate rankings. */
  query?: string;
  limit?: number;
  keywordResults?: RankedAzk[];
  semanticResults?: RankedAzk[];

  /** reindex queue and counters. */
  allIds?: string[];
  remainingIds?: string[];
  indexed?: number;
  updated?: number;
  removed?: number;
  total?: number;
}

type NodeId =
  | "DISPATCH"
  | "USAGE"
  // search
  | "SEARCH_INPUT"
  | "SEARCH_KEYWORD"
  | "SEARCH_EMBED"
  | "SEARCH_SEMANTIC"
  | "SEARCH_MERGE_RANK"
  // create
  | "CREATE_INPUT"
  | "CREATE_INIT"
  | "CREATE_EMBED"
  | "CREATE_WRITE_NOTE"
  | "CREATE_INDEX_UPSERT"
  | "CREATE_LINKS"
  | "CREATE_FINISH"
  // get
  | "GET_ID_ARG"
  | "GET_EXISTS_CHECK"
  | "GET"
  // update
  | "UPDATE_ID_ARG"
  | "UPDATE_INPUT"
  | "UPDATE_EXISTS_CHECK"
  | "UPDATE_MERGE"
  | "UPDATE_EMBED"
  | "UPDATE_WRITE_NOTE"
  | "UPDATE_INDEX_UPSERT"
  | "UPDATE_FINISH"
  // delete
  | "DELETE_ID_ARG"
  | "DELETE_EXISTS_CHECK"
  | "DELETE"
  // link
  | "LINK_INPUT"
  | "LINK_VALIDATE"
  | "LINK_WRITE_NOTE"
  | "LINK_CREATE_LINKS"
  | "LINK_FINISH"
  // reindex
  | "REINDEX_LIST"
  | "REINDEX_NEXT"
  | "REINDEX_DETECT_CHANGE"
  | "REINDEX_EMBED"
  | "REINDEX_INDEX_UPSERT"
  | "REINDEX_REPLACE_LINKS"
  | "REINDEX_PRUNE_ORPHANS"
  | "REINDEX_FINISH";

/**
 * Seven chains sharing one graph. Several factories appear at more than one
 * node id — `embed` at four, `write-note` and `index-upsert` at three — since
 * a node id is a position in the graph while the factory is the unit of
 * reuse. Two verbs could only share a position if their chains were identical
 * from there to termination, and each ends at its own finish node, so none
 * are.
 *
 * A wiring mistake that names a node id which doesn't exist is a compile
 * error; one that names a valid but wrong id is not. Type errors here
 * generally mean a node's `State` and this walk's `State` disagree, and they
 * are reported against the wiring line rather than the node.
 */
const amble = ambler<State, NodeId>({
  DISPATCH: () =>
    dispatchNode.factory({
      onSearch: "SEARCH_INPUT",
      onCreate: "CREATE_INPUT",
      onGet: "GET_ID_ARG",
      onUpdate: "UPDATE_ID_ARG",
      onDelete: "DELETE_ID_ARG",
      onLink: "LINK_INPUT",
      onReindex: "REINDEX_LIST",
      onUnknown: "USAGE",
    }),
  USAGE: () => usageNode.factory({ onExplained: null }),

  SEARCH_INPUT: () =>
    searchInputNode.factory({
      onParsed: "SEARCH_KEYWORD",
      onMissing: "USAGE",
    }),
  SEARCH_KEYWORD: () =>
    searchKeywordNode.factory({ onSearched: "SEARCH_EMBED" }),
  SEARCH_EMBED: () => embedNode.factory({ onEmbedded: "SEARCH_SEMANTIC" }),
  SEARCH_SEMANTIC: () =>
    searchSemanticNode.factory({ onScored: "SEARCH_MERGE_RANK" }),
  SEARCH_MERGE_RANK: () =>
    searchMergeRankNode.factory({ onFound: null, onEmpty: null }),

  CREATE_INPUT: () =>
    createInputNode.factory({ onParsed: "CREATE_INIT", onInvalid: "USAGE" }),
  CREATE_INIT: () => createInitNode.factory({ onReady: "CREATE_EMBED" }),
  CREATE_EMBED: () => embedNode.factory({ onEmbedded: "CREATE_WRITE_NOTE" }),
  CREATE_WRITE_NOTE: () =>
    writeNoteNode.factory({
      onWritten: "CREATE_INDEX_UPSERT",
      onError: null,
    }),
  CREATE_INDEX_UPSERT: () =>
    indexUpsertNode.factory({ onIndexed: "CREATE_LINKS", onError: null }),
  CREATE_LINKS: () =>
    createLinksNode.factory({ onDone: "CREATE_FINISH", onError: null }),
  CREATE_FINISH: () => createFinishNode.factory({ onCreated: null }),

  GET_ID_ARG: () =>
    idArgNode.factory({ onParsed: "GET_EXISTS_CHECK", onMissing: "USAGE" }),
  GET_EXISTS_CHECK: () =>
    existsCheckNode.factory({ onFound: "GET", onNotFound: null }),
  GET: () => getNode.factory({ onFound: null }),

  UPDATE_ID_ARG: () =>
    idArgNode.factory(
      { onParsed: "UPDATE_INPUT", onMissing: "USAGE" },
      // update reads stdin as well as an id, so it says so.
      { usage: () => `Usage: echo '{"title":"..."}' | azk update <id>` },
    ),
  UPDATE_INPUT: () =>
    updateInputNode.factory({
      onParsed: "UPDATE_EXISTS_CHECK",
      onInvalid: "USAGE",
    }),
  UPDATE_EXISTS_CHECK: () =>
    existsCheckNode.factory({ onFound: "UPDATE_MERGE", onNotFound: null }),
  UPDATE_MERGE: () => updateMergeNode.factory({ onMerged: "UPDATE_EMBED" }),
  UPDATE_EMBED: () => embedNode.factory({ onEmbedded: "UPDATE_WRITE_NOTE" }),
  UPDATE_WRITE_NOTE: () =>
    writeNoteNode.factory({
      onWritten: "UPDATE_INDEX_UPSERT",
      onError: null,
    }),
  UPDATE_INDEX_UPSERT: () =>
    indexUpsertNode.factory({ onIndexed: "UPDATE_FINISH", onError: null }),
  UPDATE_FINISH: () => updateFinishNode.factory({ onUpdated: null }),

  DELETE_ID_ARG: () =>
    idArgNode.factory({ onParsed: "DELETE_EXISTS_CHECK", onMissing: "USAGE" }),
  DELETE_EXISTS_CHECK: () =>
    existsCheckNode.factory({ onFound: "DELETE", onNotFound: null }),
  DELETE: () => deleteNode.factory({ onDeleted: null }),

  LINK_INPUT: () =>
    linkInputNode.factory({ onParsed: "LINK_VALIDATE", onMissing: "USAGE" }),
  LINK_VALIDATE: () =>
    linkValidateNode.factory({ onValid: "LINK_WRITE_NOTE", onError: null }),
  // link deliberately doesn't re-index the note it touches, matching the
  // behaviour azk has always had: only the link graph and the file change.
  LINK_WRITE_NOTE: () =>
    writeNoteNode.factory({
      onWritten: "LINK_CREATE_LINKS",
      onError: null,
    }),
  LINK_CREATE_LINKS: () =>
    createLinksNode.factory({ onDone: "LINK_FINISH", onError: null }),
  LINK_FINISH: () => linkFinishNode.factory({ onLinked: null }),

  REINDEX_LIST: () => reindexListNode.factory({ onListed: "REINDEX_NEXT" }),
  REINDEX_NEXT: () =>
    reindexNextNode.factory({
      onNext: "REINDEX_DETECT_CHANGE",
      onDone: "REINDEX_PRUNE_ORPHANS",
    }),
  REINDEX_DETECT_CHANGE: () =>
    reindexDetectChangeNode.factory({
      onChecked: "REINDEX_EMBED",
      onMissing: "REINDEX_NEXT",
    }),
  REINDEX_EMBED: () =>
    embedNode.factory({ onEmbedded: "REINDEX_INDEX_UPSERT" }),
  REINDEX_INDEX_UPSERT: () =>
    indexUpsertNode.factory({
      onIndexed: "REINDEX_REPLACE_LINKS",
      onError: null,
    }),
  REINDEX_REPLACE_LINKS: () =>
    reindexReplaceLinksNode.factory({ onReplaced: "REINDEX_NEXT" }),
  REINDEX_PRUNE_ORPHANS: () =>
    reindexPruneOrphansNode.factory({ onPruned: "REINDEX_FINISH" }),
  REINDEX_FINISH: () => reindexFinishNode.factory({ onIndexed: null }),
});

if (import.meta.main) {
  let nodeId: NodeId | null = "DISPATCH";
  let state: State = { argv: Deno.args };

  while (nodeId) {
    const next = amble(nodeId, state);
    [nodeId, state] = next instanceof Promise ? await next : next;
  }

  // A bad invocation exits non-zero; a failure inside a verb prints
  // `{ error }` and still exits 0, which is the contract azk has always had.
  if (state.usage) Deno.exit(1);
}
