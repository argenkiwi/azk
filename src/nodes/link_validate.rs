use crate::Node;
use crate::model::{Link, NoteLink};
use crate::nodes::{HasError, HasLinkArgs, HasLinks, HasNote, fail};
use crate::utils::{NoteStore, Out};
use std::convert::Infallible;

/// Where [`LinkValidate`] leaves the walk.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    Valid,
    /// An end of the link is missing; the error was printed.
    Invalid,
}

/// Requires both ends of a `link` to exist, then appends the link to the source note's
/// frontmatter and restates it in the form the link graph wants.
#[derive(Clone, Debug, Default)]
pub struct LinkValidate<U> {
    utils: U,
}

impl<U> LinkValidate<U> {
    #[must_use]
    pub fn with_utils(utils: U) -> Self {
        Self { utils }
    }
}

impl<S, U> Node<S> for LinkValidate<U>
where
    S: HasLinks + HasLinkArgs + HasNote + HasError + Send,
    U: NoteStore + Out + Sync,
{
    type Outcome = Outcome;
    type Error = Infallible;

    async fn run(&self, state: &mut S) -> Result<Outcome, Infallible> {
        let from = state.source_id().clone().unwrap_or_default();
        let to = state.to_id().clone().unwrap_or_default();
        let relation = state.relation().clone().unwrap_or_default();
        let mut notes = Vec::new();
        for id in [&from, &to] {
            match self.utils.read(id) {
                Ok(Some(note)) => notes.push(note),
                Ok(None) => {
                    fail(&self.utils, state, format!("note {id} not found"));
                    return Ok(Outcome::Invalid);
                }
                Err(e) => {
                    fail(&self.utils, state, format!("could not read note {id}: {e}"));
                    return Ok(Outcome::Invalid);
                }
            }
        }
        let mut source = notes.swap_remove(0);
        let link = NoteLink {
            to: to.clone(),
            relation: relation.clone(),
        };
        if !source.links.contains(&link) {
            source.links.push(link);
        }
        *state.note_mut() = Some(source);
        *state.links_mut() = vec![Link {
            to_id: to,
            relation,
        }];
        Ok(Outcome::Valid)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::impl_has;
    use crate::model::Note;
    use crate::testing::{Fake, note};

    #[derive(Default)]
    struct State {
        error: Option<String>,
        from_id: Option<String>,
        to_id: Option<String>,
        relation: Option<String>,
        links: Vec<Link>,
        note: Option<Note>,
    }

    impl_has!(State: error, links, link_args, note);

    async fn validate(fake: &Fake) -> (Outcome, State) {
        let mut state = State {
            from_id: Some("a".into()),
            to_id: Some("b".into()),
            relation: Some("r".into()),
            ..State::default()
        };
        let Ok(outcome) = LinkValidate::with_utils(fake).run(&mut state).await;
        (outcome, state)
    }

    fn both_ends() -> Fake {
        Fake::default()
            .with_note(note("a", "A", "x"))
            .with_note(note("b", "B", "y"))
    }

    fn r() -> NoteLink {
        NoteLink {
            to: "b".into(),
            relation: "r".into(),
        }
    }

    #[tokio::test]
    async fn appends_the_link_to_the_source_when_both_ends_exist() {
        let fake = both_ends();

        let (outcome, state) = validate(&fake).await;

        assert_eq!(outcome, Outcome::Valid);
        let source = state.note.unwrap();
        assert_eq!(source.id, "a");
        assert_eq!(source.links, [r()]);
        assert_eq!(
            state.links,
            [Link {
                to_id: "b".into(),
                relation: "r".into()
            }]
        );
        assert!(fake.printed().is_empty());
    }

    #[tokio::test]
    async fn does_not_duplicate_a_link_already_in_the_frontmatter() {
        let mut a = note("a", "A", "x");
        a.links.push(r());
        let fake = Fake::default().with_note(a).with_note(note("b", "B", "y"));

        let (outcome, state) = validate(&fake).await;

        assert_eq!(outcome, Outcome::Valid);
        assert_eq!(state.note.unwrap().links, [r()]);
    }

    #[tokio::test]
    async fn prints_an_error_when_the_source_is_missing() {
        let fake = Fake::default().with_note(note("b", "B", "y"));

        let (outcome, state) = validate(&fake).await;

        assert_eq!(outcome, Outcome::Invalid);
        assert_eq!(state.error.as_deref(), Some("note a not found"));
        assert_eq!(fake.printed_json()["error"], "note a not found");
        assert_eq!(state.note, None);
    }

    #[tokio::test]
    async fn prints_an_error_when_the_target_is_missing() {
        let fake = Fake::default().with_note(note("a", "A", "x"));

        let (outcome, state) = validate(&fake).await;

        assert_eq!(outcome, Outcome::Invalid);
        assert_eq!(state.error.as_deref(), Some("note b not found"));
        assert!(state.links.is_empty());
    }

    #[tokio::test]
    async fn prints_an_error_when_a_note_cannot_be_read() {
        let fake = Fake {
            fail_notes: true,
            ..both_ends()
        };

        let (outcome, state) = validate(&fake).await;

        assert_eq!(outcome, Outcome::Invalid);
        assert_eq!(
            state.error.as_deref(),
            Some("could not read note a: disk is broken")
        );
    }
}
