---
name: ambler-node
description: Creates a new Ambler node in src/nodes/ — with inline tests, using test-driven development. Use this whenever the user wants to add a node, step, or state to the azk walks — even if they phrase it as "add a step", "create a handler", or describe the behaviour without using the word "node". Also use when creating a node WITH tests or following TDD for a new node. For adding tests to an existing node that already has an implementation, use `/ambler-test` instead.
metadata:
  author: leandro
  version: "4.0-azk"
---

# Ambler Node (azk)

Follow these steps to create a new node using test-driven development. Tests are written before the implementation.

A node is a struct that implements `Node<S>` (from `src/lib.rs`). It mutates the shared state through `&mut S` and returns an `Outcome` enum saying what happened. It never names the node that comes next — the walk wires each outcome to a successor (see `/ambler-walk`).

```rust
pub trait Node<S> {
    type Outcome;
    type Error;
    fn run(&self, state: &mut S) -> impl Future<Output = Result<Self::Outcome, Self::Error>> + Send;
}
```

azk nodes depend on two kinds of trait, never on concrete types:

- **State traits** (`HasId`, `HasNote`, `HasError`, `HasUsage`, …) in `src/nodes/mod.rs` — borrowed accessors onto the walk's `State`.
- **Capability traits** (`Out`, `Stdin`, `Clock`, `NoteStore`, `Embedder`, `Index`) in `src/utils/mod.rs` — every side effect. `utils::System` implements all of them for production; `testing::Fake` implements all of them for `&Fake` in tests.

Reference nodes: `src/nodes/id_arg.rs` (no side effects), `src/nodes/exists_check.rs` (side effects, with inline tests).

## 1. Gather requirements

Before writing any code, determine:

- **Research existing nodes:** Check `specs/*.md` and `src/nodes/` for a node that already does this. Reuse beats duplication — `id_arg`, `exists_check`, `embed`, `write_note`, `index_upsert`, `create_links` and `usage` are each shared by several walks.
- **Node name**: `src/nodes/<name>.rs` (`snake_case`, no `_node` suffix), struct `<Name>` (`PascalCase`).
- **State shape**: What does the node read or mutate? Reuse a `Has*` trait from `src/nodes/mod.rs` where one fits; otherwise add one there (and an arm for it in `impl_has!`). Require only the traits the node touches.
- **Capabilities**: Which side effects does it need? Bound `U` on exactly those capability traits (e.g. `U: NoteStore + Out + Sync`). If no existing capability covers it, add one with `/ambler-util` first.
- **Outcomes**: One `Outcome` variant per outgoing edge (e.g. `Found`, `Missing`). A terminal node uses `type Outcome = ();`.
- **Failures**: azk reports failures *inside* a verb as `{ "error": ... }` on stdout and exits 0. So a node that hits a store or index error calls `fail(&self.utils, state, message)` and returns an outcome (or `()`), and its `type Error` is `std::convert::Infallible`. Use a real `Error` type only for something the walk must abort on.
- **Branches**: List every outcome the node can produce. Each becomes one test. These types and branches are the contract — if they need to change during implementation, restart from this step.

---

## 2. Create a skeleton `src/nodes/<name>.rs`

Register it in `src/nodes/mod.rs` (keep the list alphabetical). Then write only the type exports and a stub `run` whose body is `todo!()`, so the tests fail in step 4:

```rust
use crate::Node;
use crate::nodes::{HasError, HasId, HasNote};
use crate::utils::{NoteStore, Out};
use std::convert::Infallible;

/// Where [`<Name>`] leaves the walk.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    Found,
    Missing,
}

/// One-sentence description of what the node does.
#[derive(Clone, Debug, Default)]
pub struct <Name><U> {
    utils: U,
}

impl<U> <Name><U> {
    #[must_use]
    pub fn with_utils(utils: U) -> Self {
        Self { utils }
    }
}

impl<S, U> Node<S> for <Name><U>
where
    S: HasId + HasNote + HasError + Send,
    U: NoteStore + Out + Sync,
{
    type Outcome = Outcome;
    type Error = Infallible;

    async fn run(&self, _state: &mut S) -> Result<Outcome, Infallible> {
        todo!()
    }
}
```

A node with no side effects has no `utils` field and offers `new()` instead (see `IdArg`).

```bash
cargo check
```

---

## 3. Write the tests in `src/nodes/<name>.rs`

Append a `#[cfg(test)] mod tests` block with one `#[tokio::test]` per branch. Build a minimal `State` with `impl_has!` and pass a `&Fake` as the utils — no real files, index or network. From `src/nodes/exists_check.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::impl_has;
    use crate::model::Note;
    use crate::testing::{Fake, note};

    #[derive(Default)]
    struct State {
        id: Option<String>,
        note: Option<Note>,
        error: Option<String>,
    }

    impl_has!(State: id, note, error);

    async fn check(fake: &Fake, id: &str) -> (Outcome, State) {
        let mut state = State {
            id: Some(id.into()),
            ..State::default()
        };
        let Ok(outcome) = ExistsCheck::with_utils(fake).run(&mut state).await;
        (outcome, state)
    }

    #[tokio::test]
    async fn prints_an_error_when_missing() {
        let fake = Fake::default();

        let (outcome, state) = check(&fake, "nope").await;

        assert_eq!(outcome, Outcome::Missing);
        assert_eq!(state.error.as_deref(), Some("note nope not found"));
        assert_eq!(fake.printed_json()["error"], "note nope not found");
    }
}
```

Script the `Fake` per test: `with_note(..)` seeds a file, `stdin`, `vector` (`None` = embeddings host unreachable), `keyword_hits` / `semantic_hits`, and `fail_index` to make index writes fail. Assert with `printed()`, `printed_json()`, `eprinted()`, `file(id)`, `stored_vector(id)` and the `links` / `embedded` fields. If the node needs a capability `Fake` doesn't script yet, extend `src/testing.rs`.

### Test rules

- **One test per branch** — one per outcome (and per error, if the node has one).
- **No real side effects** — always `&Fake`, never `System`.
- **Minimal state** — the test `State` has only the fields for the traits the node requires.
- **Assert the `Outcome`, the state and what was printed** — never node ids; nodes don't know them.
- **Test names**: `snake_case`, describing the behaviour and condition (e.g. `prints_an_error_when_missing`).
- **Always `#[tokio::test]` and `.await`** — `run` returns a future even for synchronous nodes.

---

## 4. Run tests — expect failure

```bash
cargo test nodes::<name>::
```

They must fail with `not yet implemented`. A compile error means the skeleton types don't match the tests — fix the skeleton, not the tests. If they pass, the stub was too complete.

---

## 5. Implement `src/nodes/<name>.rs`

Replace the `todo!()` and drop the underscore from `state`. The exports and the `Node` impl signature stay as written in step 2.

```rust
async fn run(&self, state: &mut S) -> Result<Outcome, Infallible> {
    let id = state.id().clone().unwrap_or_default();
    match self.utils.read(&id) {
        Ok(Some(note)) => {
            *state.note_mut() = Some(note);
            Ok(Outcome::Found)
        }
        Ok(None) => {
            fail(&self.utils, state, format!("note {id} not found"));
            Ok(Outcome::Missing)
        }
        Err(e) => {
            fail(&self.utils, state, format!("could not read note {id}: {e}"));
            Ok(Outcome::Missing)
        }
    }
}
```

### Key rules

- **State**: Change it only through the trait accessors on `&mut S`.
- **Outcomes**: Return a variant — never construct or mention a node id.
- **Output**: Every verb prints at most one JSON value to stdout — use `print_json` / `fail` from `src/nodes/mod.rs`. Usage text goes to stderr via the `usage` node.
- **Side effects**: Only through `self.utils.*`. Real implementations live in `src/utils/` behind a capability trait (`/ambler-util`).
- **`Send` futures**: bounds are `S: … + Send` and `U: … + Sync`. Don't hold a `std::sync::MutexGuard` across an `.await`.
- **Termination**: a terminal node has `type Outcome = ();` and the walk answers with `Transition::Halt`.
- **Don't modify the tests** between steps 4 and 6.

---

## 5a. Reusing a node in another walk

Nodes depend on traits, so a walk reuses a node by implementing its `Has*` traits on its own `State` — usually just by naming the fields in `impl_has!(State: id, note, error)`. If a field must be named differently, implement the trait by hand. Only write a new node if the behaviour itself must change.

---

## 6. Run tests — must pass

```bash
cargo test nodes::<name>::
cargo clippy --all-targets -- -D warnings
```

Fix the implementation, never the tests.

---

## 7. Checklist

- [ ] `src/nodes/<name>.rs` exists and `pub mod <name>;` is in `src/nodes/mod.rs`.
- [ ] Any new state trait is in `src/nodes/mod.rs`, with an `impl_has!` arm.
- [ ] `Outcome` has one variant per outgoing edge (or `()` for a terminal node).
- [ ] Bounds are minimal: only the `Has*` and capability traits the node uses.
- [ ] Failures inside the verb are printed with `fail` and returned as an outcome.
- [ ] One `#[tokio::test]` per branch, using `&Fake`.
- [ ] Tests were written before the implementation, failed in step 4 and passed in step 6 unmodified.
