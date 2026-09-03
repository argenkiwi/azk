import { ambler } from "../ambler.ts";
import { runWalk } from "../walk.ts";
import { usageExit } from "../utils/cli.ts";
import defer * as getNode from "../nodes/get.ts";
import { AzkLink } from "../utils/db.ts";
import { Note } from "../utils/fs.ts";

export interface State {
  id: string;
  result?: Note & { links: AzkLink[] };
  error?: string;
}

type NodeId = "GET";

const amble = ambler<State, NodeId>({
  GET: () => getNode.factory({ onFound: null, onNotFound: null }),
});

export async function main(argv: string[]): Promise<void> {
  const id = argv[0];
  if (!id) usageExit("Usage: azk get <id>");

  const state = await runWalk(amble, "GET", { id });
  if (state.error) Deno.exit(1);
}

if (import.meta.main) {
  await main(Deno.args);
}
