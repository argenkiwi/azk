import { Next } from "./ambler.ts";

/**
 * Drives an Ambler walk to completion: runs `start`, then follows the
 * returned node id until one returns `null`, returning the final state.
 *
 * @param amble - The runner returned by {@link ambler}.
 * @param start - The first node id to run.
 * @param state - The walk's initial state.
 * @returns The state after the last node ran.
 */
export async function runWalk<S, K extends string>(
  amble: (nodeId: K, state: S) => Next<S, K> | Promise<Next<S, K>>,
  start: K,
  state: S,
): Promise<S> {
  let nodeId: K | null = start;

  while (nodeId) {
    const next = amble(nodeId, state);
    [nodeId, state] = next instanceof Promise ? await next : next;
  }

  return state;
}
