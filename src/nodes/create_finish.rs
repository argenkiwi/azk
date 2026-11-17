use crate::Node;
use crate::nodes::{HasLinks, HasNote, print_json};
use crate::utils::Out;
use serde_json::json;
use std::convert::Infallible;

/// Prints the created note's summary, for `create`. Terminal.
#[derive(Clone, Debug, Default)]
pub struct CreateFinish<U> {
    utils: U,
}

impl<U> CreateFinish<U> {
    #[must_use]
    pub fn with_utils(utils: U) -> Self {
        Self { utils }
    }
}

impl<S, U> Node<S> for CreateFinish<U>
where
    S: HasNote + HasLinks + Send,
    U: Out + Sync,
{
    type Outcome = ();
    type Error = Infallible;

    async fn run(&self, state: &mut S) -> Result<(), Infallible> {
        if let Some(note) = state.note() {
            print_json(
                &self.utils,
                &json!({
                    "id": note.id,
                    "title": note.title,
                    "tags": note.tags,
                    "created": note.created,
                    "links": state.links(),
                }),
            );
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::impl_has;
    use crate::model::{Link, Note};
    use crate::testing::{Fake, note};

    #[derive(Default)]
    struct State {
        from_id: Option<String>,
        links: Vec<Link>,
        note: Option<Note>,
    }

    impl_has!(State: links, note);

    #[tokio::test]
    async fn prints_the_summary_with_caller_form_links() {
        let fake = Fake::default();
        let mut state = State {
            note: Some(note("a", "A", "body")),
            links: vec![Link {
                to_id: "o".into(),
                relation: "r".into(),
            }],
            ..State::default()
        };

        let Ok(()) = CreateFinish::with_utils(&fake).run(&mut state).await;

        assert_eq!(
            fake.printed_json(),
            json!({"id":"a","title":"A","tags":[],"created":"2026-01-01T00:00:00.000Z",
                   "links":[{"toId":"o","relation":"r"}]})
        );
    }

    #[tokio::test]
    async fn prints_nothing_without_a_note() {
        let fake = Fake::default();
        let mut state = State::default();

        let Ok(()) = CreateFinish::with_utils(&fake).run(&mut state).await;

        assert!(fake.printed().is_empty());
    }
}
