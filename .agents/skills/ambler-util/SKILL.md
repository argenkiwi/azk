---
name: ambler-util
description: Creates or extends the side-effect layer in src/utils/ of azk — a capability trait in src/utils/mod.rs, its production implementation on System, and its scripted stand-in on testing::Fake. Use this whenever a node needs a new side effect (file I/O, HTTP, a new crate, environment access) or a helper reusable across nodes — even if the user just says "add a util", "extract this helper", "share this function", or "this code is getting too long for the node".
metadata:
  author: leandro
  version: "4.0-azk"
---

# Ambler Util (azk)

azk keeps every side effect behind a narrow **capability trait** in `src/utils/mod.rs` (`Out`, `Stdin`, `Clock`, `NoteStore`, `Embedder`, `Index`). Nodes are generic over `U` and bound it on just the capabilities they use. Two types implement every capability:

- `System` (`src/utils/system.rs`) — production. Each method is a one-line delegation to a plain function in a module such as `src/utils/notes.rs`, `index.rs`, `embed.rs` or `clock.rs`.
- `Fake` (`src/testing.rs`) — tests, implemented for `&Fake` and scripted per test.

## When to add or change a util

- A node needs a side effect that no existing capability covers. Add a method to the closest trait, or a new trait if none fits.
- Logic is reusable across nodes, or too complex to inline (parsing, SQL, HTTP, retries).
- A new crate is needed. Only `src/utils/` modules may depend on I/O crates.

Pure helpers that every node shares without side effects, such as `print_json` and `fail`, belong in `src/nodes/mod.rs`.

---

## 1. Gather requirements

- **Capability**: the trait and method signatures, at the domain level, e.g. `fn read(&self, id: &str) -> io::Result<Option<Note>>`. Use the conventions already in place: `io::Result` for disk, `Result<_, String>` (a caller-facing message) for the index, and `Option` only where "no answer" is a normal result (an unreachable embeddings host).
- **Module**: which `src/utils/<name>.rs` holds the real implementation.
- **Crates**: any new dependency and its features.
- **Consumers**: which nodes will bound on it.

Ask the user if any of this is unclear.

## 2. Implement the module `src/utils/<name>.rs`

Plain Rust functions, with no imports from `crate::nodes`, `crate::walks` or `crate::Node`. From `src/utils/embed.rs`:

```rust
/// Embeds `text`, or `None` if the host is unreachable or answers badly.
#[must_use]
pub fn embed(text: &str) -> Option<Vec<f32>> {
    let model = std::env::var("EMBEDDING_MODEL").unwrap_or_else(|_| "nomic-embed-text".into());
    // …
}
```

Rules:

- **Export functions, not clients**. Keep connections, caches and locks private to the module.
- **Named constants** for paths, URLs and defaults (`notes::DIR`, `index::PATH`).
- **Doc comments** on every export: a one-line summary, plus `# Errors` for fallible functions.
- **Unit tests** for pure logic go inline in the module (see the `#[cfg(test)]` blocks in `notes.rs` and `index.rs`).

Register the module with `pub mod <name>;` in `src/utils/mod.rs`, keeping the list alphabetical.

## 3. Wire the capability

1. **Trait** — add or extend it in `src/utils/mod.rs`:

   ```rust
   /// The embeddings host. An unreachable host yields `None`, never an error.
   pub trait Embedder {
       fn embed(&self, text: &str) -> Option<Vec<f32>>;
   }
   ```

2. **System** — delegate in `src/utils/system.rs`:

   ```rust
   impl Embedder for System {
       fn embed(&self, text: &str) -> Option<Vec<f32>> {
           embed::embed(text)
       }
   }
   ```

3. **Fake** — implement it for `&Fake` in `src/testing.rs`, backed by a scriptable field. Record calls behind a `Mutex` so tests can assert on them:

   ```rust
   impl Embedder for &Fake {
       fn embed(&self, text: &str) -> Option<Vec<f32>> {
           self.embedded.lock().unwrap().push(text.into());
           self.vector.clone()
       }
   }
   ```

4. **Nodes** — bound `U` on the trait (`U: Embedder + Sync`) and call `self.utils.embed(..)`. Every walk that uses the node gets the bound added to its `impl Walk` block.

## 4. Dependencies

```bash
cargo add <crate> --features <features>
```

Check `Cargo.toml` first: `rusqlite` (bundled), `serde`, `serde_json`, `serde_yaml`, `ureq`, `rand`, `thiserror` and `tokio` (`macros`, `rt-multi-thread`) are already there.

## 5. Checklist

- [ ] The real logic is in `src/utils/<name>.rs`, registered in `src/utils/mod.rs`, with doc comments.
- [ ] The capability trait is in `src/utils/mod.rs`.
- [ ] `System` delegates to the module, and `&Fake` scripts the capability.
- [ ] Consuming nodes and walks bound `U` on the trait.
- [ ] The util module imports nothing from `crate::nodes` or `crate::walks`.
- [ ] `cargo test` and `cargo clippy --all-targets -- -D warnings` are clean.
