---
name: ambler
description: "Builds programs with Ambler, where a program is a walk (a state machine) of small, tested nodes, using the `cargo ambler` command line. Use this whenever the user wants to add or change a node, step, state, handler, walk, flow, program, utility or spec in an Ambler project, even if they only describe the behaviour: \"add a step that asks for a name\", \"wire up these nodes\", \"extract this helper\", \"write a spec\", \"add tests for this node\"."
metadata:
  author: leandro
  version: "1.1"
---

# Ambler

The `cargo ambler` command line holds the conventions and does the mechanical work: it writes files in the right place, registers them and generates the wiring. Your part is the design: which outcomes a node has, what state it needs, what its tests prove, where each outcome leads.

Do not write or register nodes, walks or utility modules by hand, and do not work from memory of the conventions. Run the verb, read the guide it points to, then edit what was generated.

| The user wants | Run | Read first |
|---|---|---|
| A node, step or handler | `cargo ambler node <name> …` | `cargo ambler help node-design` |
| Tests for a node | nothing to generate | `cargo ambler help testing` |
| A helper shared by nodes, or one that needs a crate | `cargo ambler util <name>` | `cargo ambler help util` |
| A walk, flow or program | `cargo ambler walk <name> --nodes … --edge …` | `cargo ambler help walk` |
| A spec | written by hand; `cargo ambler walk` starts it | `cargo ambler help spec` |
| To know the work is done | `cargo ambler check` | `cargo ambler help check` |

`cargo ambler help` with no topic shows the layout and the usual order of work. `cargo ambler` is an alias in `.cargo/config.toml` for the `xtask` crate, which embeds the CLI from the `ambler` library (`argenkiwi/ambler-rs`); nothing needs installing.

**In azk**, `cargo ambler` generates the default Ambler shape, which azk adapts: shared capability traits with `System` and `testing::Fake` instead of per-node `Utils`, `impl_has!` for state, verb-prefixed node names, and verb walks dispatched from `src/main.rs` (`cargo ambler walk … --no-runner`). Read "Where azk departs from what `cargo ambler` generates" in `AGENTS.md` before editing generated code.
