---
name: ambler-test
description: Adds or updates tests for an existing Ambler node or walk that already has an implementation. Use this when a node in src/nodes/<name>.rs or a walk in src/walks/<name>.rs needs coverage, when tests need extending after new branches were added, or when retrofitting TDD onto existing code. For creating a brand-new node with tests, use `/ambler-node` instead.
metadata:
  author: leandro
  version: "4.0-azk"
---

# Ambler Test (azk)

Follow these steps to add or update tests for existing code.

> For brand-new nodes, use `/ambler-node` — it creates the implementation and tests in a TDD cycle.

azk tests at two levels, both with `testing::Fake` (`src/testing.rs`) standing in for every capability (`Out`, `Stdin`, `Clock`, `NoteStore`, `Embedder`, `Index`):

- **Walk tests** (`src/walks/<verb>.rs`) — the main coverage. They drive the whole verb through `<Verb>Walk::with_utils(&fake)` and assert on what was printed and stored. Most nodes are covered only this way.
- **Node tests** (`src/nodes/<name>.rs`) — for a node whose branches are hard to reach through a walk, or that several walks share. See `src/nodes/exists_check.rs`.

---

## 1. Read the code under test

Identify:

- **For a node**: its `Has*` state bounds, its capability bounds on `U`, its `Outcome` variants and every place it calls `fail`.
- **For a walk**: every edge in `step` — each `Outcome` arm of each node — and the spec in `specs/<verb>.md`.
- **All branches**: each becomes a test.

## 2. Check existing tests

Read the file's `#[cfg(test)] mod tests` block, if any, and list the uncovered branches. Add tests only for the gaps; don't rewrite passing tests unless the interface changed.

## 3. Write the tests

**Walk test** (from `src/walks/get.rs`):

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::testing::{Fake, note};
    use serde_json::json;

    async fn get(fake: &Fake, args: &[&str]) -> State {
        let mut state = State {
            verb: "get".into(),
            args: args.iter().map(ToString::to_string).collect(),
            ..State::default()
        };
        let Ok(()) = GetWalk::with_utils(fake).run(Id::IdArg, &mut state).await;
        state
    }

    #[tokio::test]
    async fn a_missing_note_is_an_error_value_not_usage() {
        let fake = Fake::default();

        let state = get(&fake, &["nope"]).await;

        assert_eq!(state.usage, None);
        assert_eq!(fake.printed_json(), json!({"error":"note nope not found"}));
    }
}
```

**Node test**: build a minimal `State` with `impl_has!` and run the node with `&Fake` — see `/ambler-node` step 3 and `src/nodes/exists_check.rs`.

Script the `Fake` per test (`with_note`, `stdin`, `vector`, `keyword_hits`, `semantic_hits`, `fail_index`) and assert with `printed()`, `printed_json()`, `eprinted()`, `file(id)`, `stored_vector(id)`, `links` and `embedded`.

### Test rules

- **One test per branch.**
- **No real side effects** — `&Fake` only, never `System`.
- **Check the output contract** — at most one JSON value on stdout; usage on stderr; a failure inside the verb is `{ "error": ... }` with `state.usage == None`.
- **Test names**: `snake_case`, describing behaviour and condition.
- **Always `#[tokio::test]` and `.await`.**

## 4. Run

```bash
cargo test <module path>::    # e.g. walks::get:: or nodes::exists_check::
cargo clippy --all-targets -- -D warnings
```

If a test fails, fix the implementation, not the test — unless the test itself is wrong about the spec.

## 5. Checklist

- [ ] Every outcome arm (walk) or branch (node) has a dedicated test.
- [ ] Tests use `&Fake`; no real files, index or network.
- [ ] Output assertions cover stdout JSON, stderr usage, and stored state where relevant.
- [ ] All tests pass with no clippy warnings.
