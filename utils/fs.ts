import { extract as extractFrontMatter } from "@std/front-matter/yaml";
import { stringify as stringifyYaml } from "@std/yaml";
import { NOTES_DIR, notePath } from "./config.ts";

export interface NoteLink {
  to: string;
  relation: string;
}

export interface Note {
  id: string;
  title: string;
  tags: string[];
  created: string;
  updated: string;
  links: NoteLink[];
  body: string;
}

interface NoteAttrs {
  id: string;
  title: string;
  tags: string[];
  created: string;
  updated: string;
  links: NoteLink[];
}

/**
 * Parses a Markdown file's YAML frontmatter + body into a {@link Note}.
 *
 * @param raw - The full contents of a note's `.md` file.
 * @returns The parsed note.
 */
export function parseNote(raw: string): Note {
  const { attrs, body } = extractFrontMatter<NoteAttrs>(raw);
  return {
    id: attrs.id,
    title: attrs.title,
    tags: attrs.tags ?? [],
    created: attrs.created,
    updated: attrs.updated,
    links: attrs.links ?? [],
    body: body.trim(),
  };
}

/**
 * Serializes a {@link Note} into Obsidian/HelixNotes-compatible Markdown:
 * a YAML frontmatter block followed by the body.
 *
 * @param note - The note to serialize.
 */
export function serializeNote(note: Note): string {
  const attrs: NoteAttrs = {
    id: note.id,
    title: note.title,
    tags: note.tags,
    created: note.created,
    updated: note.updated,
    links: note.links,
  };
  const frontMatter = stringifyYaml(attrs);
  return `---\n${frontMatter}---\n\n${note.body}\n`;
}

/**
 * Reads and parses a note's Markdown file by id.
 *
 * @param id - The note's unique id.
 * @returns The parsed note, or `null` if no file exists for that id.
 */
export async function readNote(id: string): Promise<Note | null> {
  try {
    const raw = await Deno.readTextFile(notePath(id));
    return parseNote(raw);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return null;
    throw err;
  }
}

/**
 * Serializes and writes a note to its Markdown file, creating the notes
 * directory if it doesn't exist yet.
 *
 * @param note - The note to persist.
 */
export async function writeNote(note: Note): Promise<void> {
  await Deno.mkdir(NOTES_DIR, { recursive: true });
  await Deno.writeTextFile(notePath(note.id), serializeNote(note));
}

/**
 * Deletes a note's Markdown file. A no-op if the file doesn't exist.
 *
 * @param id - The note's unique id.
 */
export async function deleteNoteFile(id: string): Promise<void> {
  try {
    await Deno.remove(notePath(id));
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  }
}

/**
 * Reads a text file that may legitimately not exist.
 *
 * @param path - The file to read.
 * @returns Its contents, or `null` if there is no such file.
 */
export async function readTextIfExists(path: string): Promise<string | null> {
  try {
    return await Deno.readTextFile(path);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return null;
    throw err;
  }
}

/**
 * Removes a file or directory tree.
 *
 * @param path - What to remove.
 * @returns Whether there was anything there to remove.
 */
export async function removeIfExists(path: string): Promise<boolean> {
  try {
    await Deno.remove(path, { recursive: true });
    return true;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return false;
    throw err;
  }
}

/**
 * Lists the ids of every note currently on disk.
 *
 * @returns Note ids, derived from `<id>.md` filenames in the notes directory.
 */
export async function listNoteIds(): Promise<string[]> {
  const ids: string[] = [];
  try {
    for await (const entry of Deno.readDir(NOTES_DIR)) {
      if (entry.isFile && entry.name.endsWith(".md")) {
        ids.push(entry.name.slice(0, -".md".length));
      }
    }
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  }
  return ids;
}

/**
 * Hashes text content (SHA-256, hex-encoded), used to detect whether a note's
 * body changed since it was last indexed.
 *
 * @param text - The text to hash.
 */
export async function hashContent(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
