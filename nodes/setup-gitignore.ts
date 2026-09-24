import { NodeFactory } from "../ambler.ts";
import { GITIGNORE_PATH } from "../utils/config.ts";
import { readTextIfExists } from "../utils/fs.ts";
import { addAzkIgnore, hasAzkIgnore } from "../utils/setup.ts";

export interface State {
  gitignore?: "added" | "present";
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
 * Makes sure `.azk/` is gitignored, creating `.gitignore` if the project has
 * none. Any existing rule for `.azk` counts, so a re-run changes nothing.
 */
export const factory: NodeFactory<State, Edge, Utils> = (
  edges,
  utils = defaultUtils,
) =>
async (state) => {
  const content = await utils.readGitignore() ?? "";

  if (hasAzkIgnore(content)) {
    return [edges.onDone, { ...state, gitignore: "present" }];
  }

  await utils.writeGitignore(addAzkIgnore(content));
  return [edges.onDone, { ...state, gitignore: "added" }];
};
