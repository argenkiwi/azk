import { ambler } from "../ambler.ts";
import { runWalk } from "../walk.ts";
import { usageExit } from "../utils/cli.ts";
import defer * as deleteNode from "../nodes/delete.ts";

export interface State {
  id: string;
  result?: { id: string; deleted: true };
  error?: string;
}

type NodeId = "DELETE";

const amble = ambler<State, NodeId>({
  DELETE: () => deleteNode.factory({ onDeleted: null, onNotFound: null }),
});

export async function main(argv: string[]): Promise<void> {
  const id = argv[0];
  if (!id) usageExit("Usage: azk delete <id>");

  const state = await runWalk(amble, "DELETE", { id });
  if (state.error) Deno.exit(1);
}

if (import.meta.main) {
  await main(Deno.args);
}
