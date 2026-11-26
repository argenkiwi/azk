//! azk: a Zettelkasten CLI for coding agents, built as an Ambler project. Run `cargo ambler help` for
//! how it is laid out.

pub mod engine;
pub mod model;
pub mod nodes;
#[cfg(test)]
mod testing;
pub mod utils;
pub mod walks;

pub use engine::{Node, Transition, Walk};
