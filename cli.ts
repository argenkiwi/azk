/** Printed when the command line names no verb, or one azk doesn't have. */
const USAGE = `Usage: azk <verb> [args]

Verbs:
  search <query> [limit]
  create (reads JSON from stdin)
  get <id>
  update <id> (reads JSON from stdin)
  delete <id>
  link <fromId> <toId> <relation>
  reindex
  setup
  clear`;

/**
 * Each verb is its own walk, so dispatch is a module lookup rather than a node
 * transition — an ambler edge can only name a node id inside its own walk.
 *
 * The import is dynamic so a run only loads the one walk it needs. `import
 * defer` would not do here: every walk awaits `main` at the top level, and a
 * deferred module that needs async evaluation is evaluated eagerly, before
 * this file's body runs — so naming every walk in the map below would load
 * all of them on every invocation. Node imports *inside* each walk stay deferred,
 * where they are synchronous and do defer.
 *
 * Specifiers must stay literal: `deno install` statically analyses them to
 * populate the cache, and a computed path would install a binary that fails
 * on first use.
 */
const WALKS: Record<
  string,
  () => Promise<{ main(argv: string[]): Promise<void> }>
> = {
  search: () => import("./walks/search.ts"),
  create: () => import("./walks/create.ts"),
  get: () => import("./walks/get.ts"),
  update: () => import("./walks/update.ts"),
  delete: () => import("./walks/delete.ts"),
  link: () => import("./walks/link.ts"),
  reindex: () => import("./walks/reindex.ts"),
  setup: () => import("./walks/setup.ts"),
  clear: () => import("./walks/clear.ts"),
};

const [verb, ...rest] = Deno.args;
const load = verb ? WALKS[verb.toLowerCase()] : undefined;

// An unrecognised verb is a bad invocation, so it exits non-zero like every
// other one. A failure inside a verb prints `{ error }` and still exits 0.
if (!load) {
  console.error(USAGE);
  Deno.exit(1);
}

await (await load()).main(rest);
