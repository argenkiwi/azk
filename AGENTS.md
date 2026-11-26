# Agent instructions

This is an Ambler project: a program built as walks (state machines) of small, tested nodes. The `cargo ambler` command line creates its components and checks its conventions. `cargo ambler help` explains the layout; `cargo ambler help <topic>` goes deeper.

- **Create with `cargo ambler`, not by hand.** New nodes, walks and utility modules come from `cargo ambler node`, `cargo ambler walk` and `cargo ambler util`. They write the file, register it and wire what can be wired; you then edit what they generated.
- **Read before designing.** Run `cargo ambler help node-design` before choosing a node's outcomes, state and utils, `cargo ambler help walk` before wiring nodes together, and `cargo ambler help spec` before writing a spec.
- **Test first.** A generated node fails its tests with `not yet implemented`. Write the tests, see them fail, then implement `run` without touching the tests again. `cargo ambler help testing` has the rules.
- **Keep the spec true.** `specs/<walk>.md` describes each walk in plain language. Change it in the same commit as the wiring.
- **Finish with `cargo ambler check`.** It verifies the conventions, then formatting, lints and tests. The work is not done until it passes.
- **Leave `src/engine.rs` alone.** It is the same in every Ambler project.

`cargo ambler` is an alias (in `.cargo/config.toml`) for the `xtask` crate, which depends on the `ambler` library from `argenkiwi/ambler-rs` and runs its CLI. Nothing needs installing; cargo builds it on first use.

## Where azk departs from what `cargo ambler` generates

azk has ~30 nodes sharing a handful of side effects, so it replaces Ambler's per-node `Utils`/`SystemUtils`/`MockUtils` with shared capability traits. Generate with `cargo ambler`, then adapt the output as below.

**Nodes** (`cargo ambler node`):

- Delete the generated `Utils` trait and `SystemUtils`. Make the node generic over `U` and bound it on the capability traits it needs from `src/utils/mod.rs` (`Out`, `Stdin`, `Clock`, `NoteStore`, `Embedder`, `Index`), e.g. `U: NoteStore + Out + Sync`. Keep `with_utils(utils: U)`; drop `new()`. A node with no side effects is a plain unit struct.
- Name a node used by one walk after that walk: `create_input`, `link_validate`, `reindex_next`. Shared nodes (`embed`, `write_note`, `exists_check`, …) keep plain names.
- State traits live in `src/nodes/mod.rs` and are implemented with `impl_has!(State: id, note, …)`, in walks and in test states alike. A new trait gets a new `impl_has!` arm.
- A failure the spec treats as a value is an `Outcome` variant: print it with `fail(&self.utils, state, message)`, which writes `{ "error": … }` and records it in `HasError`. Only index failures that must abandon a loop or merge (`search`, `reindex`) return `StoreError`.

**Tests**: replace `MockUtils` with `crate::testing::Fake`, which implements every capability for `&Fake`. Script it with fields (`stdin`, `vector`, `keyword_hits`, `fail_index`, `fail_index_reads`, `fail_notes`, …) and assert on what it recorded (`printed()`, `printed_json()`, `file(id)`, `stored_vector(id)`, `links`). Pass `Node::with_utils(&fake)`.

**Walks** (`cargo ambler walk … --no-runner`):

- One walk per verb. The walk struct is generic over a single `U = System` passed to every node: `new()` for production, `with_utils(&fake)` for the wiring tests, which use `Fake` instead of a `Script`.
- `run(args: Vec<String>)` is the only entry point; `Error` is `super::UsageError` for verbs that can be invoked badly. A usage message makes `run` return `Err` (exit 1); an `{ "error" }` already printed still returns `Ok` (exit 0).
- `src/main.rs` dispatches on the verb, so never let `cargo ambler walk` write a runner. Add the verb's arm there, write `src/guides/<verb>.md`, register it in `GUIDES` in `src/nodes/mod.rs`, list it in `src/guides/general.md` and in the README's usage table.

**Utils** (`cargo ambler util`): a new side effect is a method on the closest capability trait in `src/utils/mod.rs` (or a new trait), implemented on `System` in `src/utils/system.rs`, delegating to a module in `src/utils/`, and on `&Fake` in `src/testing.rs` with a scriptable field. Only `src/utils/` may depend on I/O crates.

**Running it**: `cargo run -- <verb>` reads and writes `notes/` and `.azk/` in the current directory, which in this repo is azk's own Zettelkasten. Run it from a scratch directory unless you mean to change those notes.
