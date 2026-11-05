---
name: ambler-spec
description: Creates or updates a Markdown specification file for an Ambler walk in the specs/ directory. Use this whenever a user wants to document, plan, or describe a walk — including "write a spec", "document this walk", or "plan out the nodes" — even before any code exists.
metadata:
  author: leandro
  version: "4.0-azk"
---

# Ambler Specification (Rust)

This skill guides you in creating a Markdown specification file (`specs/<walk-name>.md`) for an Ambler walk. These specs describe the program's flow (nodes and edges) and the resulting shared state.

## Instructions

### 1. Identify the Walk's Name and Purpose

- If not provided, ask the user for the name and a brief description of the walk.
- The file should be named `specs/<name>.md`, matching the walk module `src/walks/<name>.rs`.

### 2. Map the Nodes and Edges

- Identify all **Nodes** in the walk (the discrete states or steps).
- For each node, identify its **Edges** (the possible transitions to other nodes).
- For each node, create a `### <Node Name>` subsection under `## Nodes`.
- Describe:
  - Its role (e.g., "Initial node").
  - Its logic (what it does).
  - Its edges (what conditions lead to which next node).

### 3. Determine the Shared State

- Aggregate the inputs required and outputs produced by all nodes.
- Identify the data structure that must be maintained throughout the walk to satisfy these node requirements.
- Describe it under a `## Shared State` heading.

### 4. Format the Markdown

Follow this exact format:

```markdown
# Program Specifications

<Brief description of the program and its purpose.>

## Nodes

### <Node Name 1>
- <Role — e.g., "Initial node.">
- <Logic — e.g., "Prompts the user to enter X.">
- <Edges — e.g., "If valid, transitions to `NEXT`. If invalid, transitions to `START`.">

### <Node Name 2>
- <Role.>
- <Logic.>
- <Edges.>

### <Node Name N>
- <Role — e.g., termination node.>
- <Logic.>
- <Termination — e.g., "Displays result and terminates.">

## Shared State

<Description of the state struct, derived from the collective needs of the nodes.>
```

### 5. Write the File

Use the Write tool to create `specs/<name>.md`.

## Guidelines

- **Consistency**: Browse `specs/*.md` before starting to identify reusable nodes and ensure the new specification follows the established style and formatting.
- **Node name casing**: Use Title Case for headings (`### Exists Check`) and backtick-quoted ALL_CAPS for references in edge descriptions (`` `EXISTS_CHECK` ``). In code these become `Id` enum variants (`Id::ExistsCheck`), and each edge becomes one `Outcome` variant of the node that follows it.
- **Clarity**: Describe *what* the program does, not *how* the code implements it — no Rust types, traits or crate names.
- **Implementation Alignment**: If `src/walks/<name>.rs` already exists, ensure the spec reflects the implementation. If it doesn't, treat the spec as a blueprint.
- **No extra sections**: Stick to `# Program Specifications`, `## Nodes`, and `## Shared State` — no additional top-level sections unless the walk clearly requires them.
- **Pragmatic State**: Don't guess the state first; look at what each node needs to know or change, and then define the state.

## Example Specification

From `specs/get.md`:

```markdown
# Program Specifications

This program is the `get` verb of the `azk` command line: it fetches one Zettelkasten note and its links.

Every node prints at most one JSON value to stdout. A missing note is a failure inside the verb: it prints `{ "error": ... }` and still exits 0. Only a bad invocation — no id — reaches `USAGE` and exits 1.

## Nodes

### Id Arg
- Initial node of the program.
- Shared with the `update` and `delete` walks.
- Reads a note id from the first argument.
- If an id was given, transitions to `EXISTS_CHECK`. Otherwise transitions to `USAGE`.

### Exists Check
- Reads the note by id and attaches it, so downstream nodes don't read it again.
- If found, transitions to `GET`. Otherwise prints `{ "error": ... }` and terminates.

### Get
- Terminal node of the program.
- Prints the note together with every link touching it in either direction.
- Terminates.

### Usage
- Terminal node, reached only from `ID_ARG`.
- Prints the pending usage message to stderr.
- Terminates. The process then exits 1.

## Shared State

- `verb`: Always `get` here.
- `args`: The verb's arguments.
- `usage`: The message `USAGE` should print. Its presence is what makes the run exit 1.
- `error`: The message a failing node already printed.
- `id`: The note being fetched.
- `note`: That note, once read from disk.
```
