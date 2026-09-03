import { ambler } from "../ambler.ts";
import { runWalk } from "../walk.ts";
import { usageExit } from "../utils/cli.ts";
import defer * as updateNode from "../nodes/update.ts";
import { readStdinJson } from "../utils/stdin.ts";

export interface State {
  id: string;
  title?: string;
  body?: string;
  tags?: string[];
  result?: { id: string; updated: true };
  error?: string;
}

type NodeId = "UPDATE";

const amble = ambler<State, NodeId>({
  UPDATE: () => updateNode.factory({ onUpdated: null, onNotFound: null }),
});

export async function main(argv: string[]): Promise<void> {
  const id = argv[0];
  if (!id) usageExit('Usage: echo \'{"title":"..."}\' | azk update <id>');

  const input = await readStdinJson<{
    title?: string;
    body?: string;
    tags?: string[];
  }>();

  const state = await runWalk(amble, "UPDATE", { id, ...input });
  if (state.error) Deno.exit(1);
}

if (import.meta.main) {
  await main(Deno.args);
}
