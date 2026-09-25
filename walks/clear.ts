import { ambler } from "../ambler.ts";
import defer * as clearGitignoreNode from "../nodes/clear-gitignore.ts";
import defer * as clearHooksNode from "../nodes/clear-hooks.ts";
import defer * as clearIndexNode from "../nodes/clear-index.ts";
import defer * as clearFinishNode from "../nodes/clear-finish.ts";

/** `clear` takes no arguments and cannot fail midway, so it is a straight line. */
export interface State {
  gitignore?: "removed" | "absent";
  hooks?: Record<string, "removed" | "absent"> | "skipped";
  index?: "deleted" | "absent";
}

type NodeId = "GITIGNORE" | "HOOKS" | "INDEX" | "FINISH";

const amble = ambler<State, NodeId>({
  GITIGNORE: () => clearGitignoreNode.factory({ onDone: "HOOKS" }),
  HOOKS: () => clearHooksNode.factory({ onDone: "INDEX" }),
  INDEX: () => clearIndexNode.factory({ onDone: "FINISH" }),
  FINISH: () => clearFinishNode.factory({ onDone: null }),
});

export async function main(_argv: string[]): Promise<void> {
  let nodeId: NodeId | null = "GITIGNORE";
  let state: State = {};

  while (nodeId) {
    const next = amble(nodeId, state);
    [nodeId, state] = next instanceof Promise ? await next : next;
  }
}

if (import.meta.main) {
  await main(Deno.args);
}
