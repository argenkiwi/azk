import { NodeFactory } from "../ambler.ts";
import { GITIGNORE_PATH } from "../utils/config.ts";
import { readTextIfExists } from "../utils/fs.ts";
import { hasAzkIgnore, removeAzkIgnore } from "../utils/setup.ts";

export interface State {
  gitignore?: "removed" | "absent";
}

export type Edge = "onDone";

export type Utils = {
  readGitignore: () => Promise<string | null>;
  writeGitignore: (content: string) => Promise<void>;
};

const defaultUtils: Utils = {
  readGitignore: () => readTextIfExists(GITIGNORE_PATH),
  writeGitignore: (content) => Deno.writeTextFile(GITIGNORE_PATH, content),
};

/**
 * Removes every `.azk` rule from `.gitignore`. The file itself is kept even
 * if that empties it — `setup` may have created it, but `clear` can't tell.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
async (state) => {
  const content = await utils.readGitignore();

  if (content === null || !hasAzkIgnore(content)) {
    return [edges.onDone, { ...state, gitignore: "absent" }];
  }

  await utils.writeGitignore(removeAzkIgnore(content));
  return [edges.onDone, { ...state, gitignore: "removed" }];
};
