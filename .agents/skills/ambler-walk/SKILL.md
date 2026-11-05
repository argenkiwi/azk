---
name: ambler-walk
description: Creates a complete Ambler walk for azk — the Rust module that wires the nodes (src/walks/<name>.rs, with its wiring tests inline), the Markdown spec (specs/<name>.md) and its dispatch from src/main.rs — and ensures all required nodes exist. Use this whenever a user wants to add a new verb or flow to azk, even if they say "new walk", "add a command", "wire up these nodes", or just describe what the CLI should do.
metadata:
  author: leandro
  version: "4.0-azk"
---

# Ambler Walk (azk)

Each azk verb is one walk. A walk consists of:

1. `src/walks/<name>.rs` — the private `State`, `Id` enum and node-owning struct, the `Walk` impl wiring each node's outcomes to successors, and inline `#[cfg(test)]` wiring tests. It exports only `Error` and `run(args)`.
2. `specs/<name>.md` — the plain-language spec of the nodes, edges and shared state.
3. An arm in `src/main.rs` dispatching the verb to `walks::<name>::run(rest)`, and a guide in `src/guides/<name>.md` for `azk help <name>`.

Reference walk: `src/walks/get.rs` (spec `specs/get.md`).

---

## Step 1 — Identify the walk

- Name: lowercase `snake_case`, matching the verb. Register it with `pub mod <name>;` in `src/walks/mod.rs`.
- Purpose: what the verb does and what JSON it prints.
- Nodes and transitions.

## Step 2 — Research and reuse

- Browse `specs/*.md` for nodes that already implement the logic. `id_arg`, `exists_check`, `embed`, `write_note`, `index_upsert`, `create_links` and `usage` are shared across verbs.
- For each node, note its `Has*` state traits (the walk's `State` must implement them all), its capability bounds (the walk's `U` must satisfy them all), and its `Outcome` variants (the walk must wire every one).

## Step 3 — Write the spec

Use `/ambler-spec` to write `specs/<name>.md`. It's the blueprint.

## Step 4 — Ensure nodes exist

For each node in the spec, create missing ones with `/ambler-node`. Add coverage with `/ambler-test` where needed.

## Step 5 — Create `src/walks/<name>.rs`

From `src/walks/get.rs`:

```rust
//! `azk get`: fetches one note and its links. See `specs/get.md`.

use crate::model::Note;
use crate::nodes::exists_check::{self, ExistsCheck};
use crate::nodes::get::Get;
use crate::nodes::id_arg::{self, IdArg};
use crate::nodes::usage::Usage;
use crate::utils::{Index, NoteStore, Out, System};
use crate::{Node, Transition, Walk, impl_has};
use std::convert::Infallible;

/// A bad invocation of the verb.
pub type Error = super::UsageError;

#[derive(Clone, Debug, Default)]
struct State {
    verb: String,
    args: Vec<String>,
    usage: Option<String>,
    error: Option<String>,
    id: Option<String>,
    note: Option<Note>,
}

impl_has!(State: verb, args, usage, error, id, note);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Id {
    IdArg,
    ExistsCheck,
    Get,
    Usage,
}

struct GetWalk<U = System> {
    id_arg: IdArg,
    exists_check: ExistsCheck<U>,
    get: Get<U>,
    usage: Usage<U>,
}

impl GetWalk {
    fn new() -> Self {
        Self::with_utils(System)
    }
}

impl<U: Clone> GetWalk<U> {
    fn with_utils(utils: U) -> Self {
        Self {
            id_arg: IdArg::new(),
            exists_check: ExistsCheck::with_utils(utils.clone()),
            get: Get::with_utils(utils.clone()),
            usage: Usage::with_utils(utils),
        }
    }
}

impl<U> Walk for GetWalk<U>
where
    U: NoteStore + Index + Out + Sync,
{
    type Id = Id;
    type State = State;
    type Error = Infallible;

    async fn step(&self, id: Id, state: &mut State) -> Result<Transition<Id>, Infallible> {
        Ok(match id {
            Id::IdArg => {
                let Ok(outcome) = self.id_arg.run(state).await;
                match outcome {
                    id_arg::Outcome::Given => Transition::Next(Id::ExistsCheck),
                    id_arg::Outcome::Missing => Transition::Next(Id::Usage),
                }
            }
            Id::ExistsCheck => {
                let Ok(outcome) = self.exists_check.run(state).await;
                match outcome {
                    exists_check::Outcome::Found => Transition::Next(Id::Get),
                    exists_check::Outcome::Missing => Transition::Halt,
                }
            }
            Id::Get => {
                let Ok(()) = self.get.run(state).await;
                Transition::Halt
            }
            Id::Usage => {
                let Ok(()) = self.usage.run(state).await;
                Transition::Halt
            }
        })
    }
}

/// Runs `azk get <id>`.
///
/// # Errors
///
/// Returns [`Error`] when the invocation is bad; its usage message has already gone to stderr.
pub async fn run(args: Vec<String>) -> Result<(), Error> {
    let mut state = State {
        verb: "get".into(),
        args,
        ..State::default()
    };
    let Ok(()) = GetWalk::new().run(Id::IdArg, &mut state).await;
    super::UsageError::check(state.usage)
}
```

**Key rules:**

- The public surface is exactly `pub type Error = super::UsageError;` and `pub async fn run(args: Vec<String>)`. `State`, `Id` and the walk struct stay private; inline tests can still reach them.
- `State` fields carry the spec's `snake_case` names, and `impl_has!` implements the traits for them. Seed `verb` and `args` in `run`.
- `Id` has one variant per node, named after the spec heading.
- The walk struct is generic over one `U = System` shared by every node. `new()` gives production wiring and `with_utils(&fake)` gives tests theirs.
- `step` matches **exhaustively** on `Id` and on each node's `Outcome`, with no `_ =>` arm, so an unwired outcome is a compile error.
- Most nodes are `Infallible`: unwrap them with `let Ok(outcome) = …;`. A failure inside the verb has already been printed as `{ "error": ... }` and the walk halts with exit code 0. Only a usage message (`state.usage`) makes `run` return `Err` (exit 1). The exception is an index failure that must abandon a loop or a merge (`search`, `reindex`): those nodes return `StoreError`, the walk uses it as `Walk::Error` and propagates it with `?`, and `run()` prints it as `{ "error": ... }`.
- The `impl Walk` bounds on `U` are the union of every node's capability bounds, plus `Sync`.
- Terminal nodes answer with `Transition::Halt`. Use `Walk::run(start, &mut state)`; don't hand-write the loop.

**Test the wiring.** Append a `#[cfg(test)] mod tests` block that drives the walk with `with_utils(&fake)` and covers each edge of the graph — see `/ambler-test` and the tests in `src/walks/get.rs`.

## Step 6 — Dispatch, guide and help

- Add an arm to the `match` in `src/main.rs`: `"<name>" => exit_code(walks::<name>::run(rest).await),`.
- Write `src/guides/<name>.md` (syntax, exact output shape, gotchas). Register it in `src/nodes/help.rs`, and list the verb in `src/guides/general.md`.
- Add the verb to the README's usage table.
- Add a crate with `cargo add <crate>` only if the walk itself needs it. Node and util dependencies are handled by `/ambler-node` and `/ambler-util`.

## Step 7 — Verify

```bash
cargo test
cargo clippy --all-targets -- -D warnings
cargo fmt --check
cargo run -- <name> <args>      # in a scratch directory: it writes notes/ and .azk/
```

## Checklist

- [ ] `specs/<name>.md` exists and its node headings match the `Id` variants.
- [ ] `src/walks/<name>.rs` is registered in `src/walks/mod.rs` and exports only `Error` and `run(args)`.
- [ ] `State` implements every `Has*` trait its nodes need (via `impl_has!`).
- [ ] Every `Outcome` of every node is matched explicitly; every `Id` has an arm.
- [ ] Inline wiring tests cover each edge, using `&Fake`.
- [ ] `src/main.rs` dispatches the verb, and `src/guides/<name>.md` exists and is registered.
- [ ] `cargo test`, clippy and fmt are clean.
