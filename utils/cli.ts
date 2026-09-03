/**
 * Prints a usage message to stderr and exits the process with status 1.
 *
 * @param message - The usage message to print.
 */
export function usageExit(message: string): never {
  console.error(message);
  Deno.exit(1);
}
