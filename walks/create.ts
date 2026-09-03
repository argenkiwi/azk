import { ambler } from "../ambler.ts";
import { runWalk } from "../walk.ts";
import defer * as createNode from "../nodes/create.ts";
import { AzkLinkInput } from "../nodes/create.ts";
import { readStdinJson } from "../utils/stdin.ts";

export interface State {
  title: string;
  body: string;
  tags: string[];
  links?: { toId: string; relation: string }[];
  result?: {
    id: string;
    title: string;
    tags: string[];
    created: string;
    links: AzkLinkInput[];
  };
  error?: string;
}

type NodeId = "CREATE";

const amble = ambler<State, NodeId>({
  CREATE: () => createNode.factory({ onCreated: null, onError: null }),
});

export async function main(_argv: string[]): Promise<void> {
  const input = await readStdinJson<{
    title: string;
    body: string;
    tags?: string[];
    links?: { toId: string; relation: string }[];
  }>();

  if (!input.title || !input.body) {
    console.error(JSON.stringify({ error: "title and body are required" }));
    Deno.exit(1);
  }

  const state = await runWalk(amble, "CREATE", {
    title: input.title,
    body: input.body,
    tags: input.tags ?? [],
    links: input.links,
  });

  if (state.error) Deno.exit(1);
}

if (import.meta.main) {
  await main(Deno.args);
}
