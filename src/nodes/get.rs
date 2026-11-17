use crate::Node;
use crate::nodes::{HasError, HasNote, fail, print_json};
use crate::utils::{Index, Out};
use serde_json::json;
use std::convert::Infallible;

/// Prints the note the existence check read, with every link touching it in either direction.
/// Terminal.
#[derive(Clone, Debug, Default)]
pub struct Get<U> {
    utils: U,
}

impl<U> Get<U> {
    #[must_use]
    pub fn with_utils(utils: U) -> Self {
        Self { utils }
    }
}

impl<S, U> Node<S> for Get<U>
where
    S: HasNote + HasError + Send,
    U: Index + Out + Sync,
{
    type Outcome = ();
    type Error = Infallible;

    async fn run(&self, state: &mut S) -> Result<(), Infallible> {
        let Some(note) = state.note().clone() else {
            fail(&self.utils, state, "no note to get".into());
            return Ok(());
        };
        match self.utils.links_for(&note.id) {
            Ok(links) => print_json(
                &self.utils,
                &json!({
                    "id": note.id,
                    "title": note.title,
                    "tags": note.tags,
                    "created": note.created,
                    "updated": note.updated,
                    "body": note.body,
                    "links": links,
                }),
            ),
            Err(e) => fail(&self.utils, state, e),
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
        note: Option<Note>,
        error: Option<String>,
    }

    impl_has!(State: note, error);

    async fn get(fake: &Fake, note: Option<Note>) -> State {
        let mut state = State {
            note,
            ..State::default()
        };
        let Ok(()) = Get::with_utils(fake).run(&mut state).await;
        state
    }

    #[tokio::test]
    async fn prints_the_note_with_links_in_both_directions() {
        let fake = Fake::default();
        let link = |to: &str| Link {
            to_id: to.into(),
            relation: "r".into(),
        };
        (&fake).add_links("a", &[link("b")]).unwrap();
        (&fake).add_links("c", &[link("a")]).unwrap();
        (&fake).add_links("b", &[link("c")]).unwrap();

        let state = get(&fake, Some(note("a", "A", "body"))).await;

        assert_eq!(state.error, None);
        assert_eq!(
            fake.printed_json(),
            json!({"id":"a","title":"A","tags":[],"created":"2026-01-01T00:00:00.000Z",
                   "updated":"2026-01-01T00:00:00.000Z","body":"body",
                   "links":[{"fromId":"a","toId":"b","relation":"r"},
                            {"fromId":"c","toId":"a","relation":"r"}]})
        );
    }

    #[tokio::test]
    async fn prints_an_error_without_a_note() {
        let fake = Fake::default();

        let state = get(&fake, None).await;

        assert_eq!(state.error.as_deref(), Some("no note to get"));
        assert_eq!(fake.printed_json()["error"], "no note to get");
    }

    #[tokio::test]
    async fn prints_an_error_when_the_links_cannot_be_read() {
        let fake = Fake {
            fail_index_reads: true,
            ..Fake::default()
        };

        let state = get(&fake, Some(note("a", "A", "body"))).await;

        assert_eq!(state.error.as_deref(), Some("index is unreadable"));
        assert_eq!(fake.printed_json()["error"], "index is unreadable");
    }
}
