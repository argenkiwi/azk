const WALKS: Record<string, () => Promise<{ main(argv: string[]): Promise<void> }>> = {
  search: () => import("./walks/search.ts"),
  create: () => import("./walks/create.ts"),
  get: () => import("./walks/get.ts"),
  update: () => import("./walks/update.ts"),
  delete: () => import("./walks/delete.ts"),
  link: () => import("./walks/link.ts"),
  reindex: () => import("./walks/reindex.ts"),
};

const [verb, ...rest] = Deno.args;
const load = verb && WALKS[verb.toLowerCase()];

if (!load) {
  console.error(
    "Usage: azk <verb> [args]\n\nVerbs:\n" +
      "  search <query> [limit]\n  create (reads JSON from stdin)\n" +
      "  get <id>\n  update <id> (reads JSON from stdin)\n" +
      "  delete <id>\n  link <fromId> <toId> <relation>\n  reindex",
  );
  Deno.exit(1);
}

await (await load()).main(rest);
