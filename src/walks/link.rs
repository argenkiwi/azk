//! `azk link`: connects two existing notes. See `specs/link.md`.

use crate::model::{Link, Note};
use crate::nodes::create_links::{self, CreateLinks};
use crate::nodes::link_finish::LinkFinish;
use crate::nodes::link_input::{self, LinkInput};
use crate::nodes::link_validate::{self, LinkValidate};
use crate::nodes::usage::Usage;
use crate::nodes::write_note::{self, WriteNote};
use crate::utils::{Index, NoteStore, Out, System};
use crate::{Node, Transition, Walk, impl_has};
use std::convert::Infallible;

/// A bad invocation of the verb.
pub type Error = super::UsageError;

#[derive(Clone, Debug, Default)]
struct State {
    args: Vec<String>,
    usage: Option<String>,
    error: Option<String>,
    from_id: Option<String>,
    to_id: Option<String>,
    relation: Option<String>,
    note: Option<Note>,
    links: Vec<Link>,
}

impl_has!(State: args, usage, error, links, link_args, note);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Id {
    Input,
    Validate,
    WriteNote,
    CreateLinks,
    Finish,
    Usage,
}

struct LinkWalk<U = System> {
    input: LinkInput,
    validate: LinkValidate<U>,
    write_note: WriteNote<U>,
    create_links: CreateLinks<U>,
    finish: LinkFinish<U>,
    usage: Usage<U>,
}

impl LinkWalk {
    #[must_use]
    fn new() -> Self {
        Self::with_utils(System)
    }
}

impl Default for LinkWalk {
    fn default() -> Self {
        Self::new()
    }
}

impl<U: Clone> LinkWalk<U> {
    #[must_use]
    fn with_utils(utils: U) -> Self {
        Self {
            input: LinkInput,
            validate: LinkValidate::with_utils(utils.clone()),
            write_note: WriteNote::with_utils(utils.clone()),
            create_links: CreateLinks::with_utils(utils.clone()),
            finish: LinkFinish::with_utils(utils.clone()),
            usage: Usage::with_utils(utils),
        }
    }
}

impl<U> Walk for LinkWalk<U>
where
    U: NoteStore + Index + Out + Sync,
{
    type Id = Id;
    type State = State;
    type Error = Infallible;

    async fn step(&self, id: Id, state: &mut State) -> Result<Transition<Id>, Infallible> {
        Ok(match id {
            Id::Input => {
                let Ok(outcome) = self.input.run(state).await;
                match outcome {
                    link_input::Outcome::Given => Transition::Next(Id::Validate),
                    link_input::Outcome::Missing => Transition::Next(Id::Usage),
                }
            }
            Id::Validate => {
                let Ok(outcome) = self.validate.run(state).await;
                match outcome {
                    link_validate::Outcome::Valid => Transition::Next(Id::WriteNote),
                    link_validate::Outcome::Invalid => Transition::Halt,
                }
            }
            Id::WriteNote => {
                let Ok(outcome) = self.write_note.run(state).await;
                match outcome {
                    write_note::Outcome::Written => Transition::Next(Id::CreateLinks),
                    write_note::Outcome::Failed => Transition::Halt,
                }
            }
            Id::CreateLinks => {
                let Ok(outcome) = self.create_links.run(state).await;
                match outcome {
                    create_links::Outcome::Recorded => Transition::Next(Id::Finish),
                    create_links::Outcome::Failed => Transition::Halt,
                }
            }
            Id::Finish => {
                let Ok(()) = self.finish.run(state).await;
                Transition::Halt
            }
            Id::Usage => {
                let Ok(()) = self.usage.run(state).await;
                Transition::Halt
            }
        })
    }
}

/// Runs `azk link <from> <to> <relation>`.
///
/// A failure inside the verb (a missing note, an unreachable index) is printed as `{ "error" }`
/// on stdout and still returns `Ok`, as the spec requires.
///
/// # Errors
///
/// Returns [`Error`] when the invocation is bad; its usage message has already gone to stderr.
pub async fn run(args: Vec<String>) -> Result<(), Error> {
    let mut state = State {
        args,
        ..State::default()
    };
    let Ok(()) = LinkWalk::new().run(Id::Input, &mut state).await;
    super::UsageError::check(state.usage)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testing::{Fake, note};
    use serde_json::json;

    async fn link(fake: &Fake, args: &[&str]) -> State {
        let mut state = State {
            args: args.iter().map(ToString::to_string).collect(),
            ..State::default()
        };
        let Ok(()) = LinkWalk::with_utils(fake).run(Id::Input, &mut state).await;
        state
    }

    fn fake() -> Fake {
        Fake::default()
            .with_note(note("a", "A", "x"))
            .with_note(note("b", "B", "y"))
    }

    #[tokio::test]
    async fn writes_the_frontmatter_and_the_graph_but_does_not_reindex() {
        let fake = fake();

        link(&fake, &["a", "b", "builds on"]).await;

        let source = fake.file("a").unwrap();
        assert_eq!(source.links[0].to, "b");
        assert_eq!(fake.links.lock().unwrap().len(), 1);
        assert!(fake.indexed.lock().unwrap().is_empty());
        assert!(fake.embedded.lock().unwrap().is_empty());
        assert_eq!(
            fake.printed_json(),
            json!({"fromId":"a","toId":"b","relation":"builds on","linked":true})
        );
    }

    #[tokio::test]
    async fn linking_twice_does_not_duplicate_the_link() {
        let fake = fake();

        link(&fake, &["a", "b", "r"]).await;
        link(&fake, &["a", "b", "r"]).await;

        assert_eq!(fake.file("a").unwrap().links.len(), 1);
        assert_eq!(fake.links.lock().unwrap().len(), 1);
    }

    #[tokio::test]
    async fn both_ends_must_exist() {
        for args in [["a", "zzz", "r"], ["zzz", "b", "r"]] {
            let fake = fake();

            let state = link(&fake, &args).await;

            assert_eq!(state.usage, None);
            assert_eq!(fake.printed_json(), json!({"error":"note zzz not found"}));
            assert!(fake.links.lock().unwrap().is_empty());
            assert!(fake.file("a").unwrap().links.is_empty());
        }
    }

    #[tokio::test]
    async fn fewer_than_three_arguments_print_usage() {
        let fake = fake();

        let state = link(&fake, &["a", "b"]).await;

        assert!(state.usage.unwrap().starts_with("Usage: azk link"));
        assert!(fake.printed().is_empty());
    }
}
