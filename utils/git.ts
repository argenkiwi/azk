/**
 * Resolves the directory git runs hooks from, honouring `core.hooksPath` and
 * linked worktrees (where `.git` is a file, not a directory).
 *
 * @returns The hooks directory, relative to the cwd unless git reports it
 * absolute, or `null` when the cwd isn't inside a git repo or git isn't
 * installed.
 */
export async function hooksDir(): Promise<string | null> {
  try {
    const { success, stdout } = await new Deno.Command("git", {
      args: ["rev-parse", "--git-path", "hooks"],
      stdout: "piped",
      stderr: "null",
    }).output();
    if (!success) return null;
    return new TextDecoder().decode(stdout).trim() || null;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return null;
    throw err;
  }
}
