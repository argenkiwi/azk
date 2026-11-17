use crate::Node;
use crate::nodes::{HasError, HasId, fail, print_json};
use crate::utils::{Index, NoteStore, Out};
use serde_json::json;
use std::convert::Infallible;

/// Removes the note's file, its index entry, and every link touching it, then confirms. Terminal.
///
/// Works from the id alone: the existence check upstream has ruled out a missing note.
#[derive(Clone, Debug, Default)]
pub struct Delete<U> {
    utils: U,
}

impl<U> Delete<U> {
    #[must_use]
    pub fn with_utils(utils: U) -> Self {
        Self { utils }
    }
}

impl<S, U> Node<S> for Delete<U>
where
    S: HasId + HasError + Send,
    U: Index + NoteStore + Out + Sync,
{
    type Outcome = ();
    type Error = Infallible;

    async fn run(&self, state: &mut S) -> Result<(), Infallible> {
        let id = state.id().clone().unwrap_or_default();
        let removed = self
            .utils
            .remove(&id)
            .map_err(|e| format!("could not remove note {id}: {e}"))
            .and_then(|()| self.utils.delete(&id));
        match removed {
            Ok(()) => print_json(&self.utils, &json!({ "id": id, "deleted": true })),
            Err(e) => fail(&self.utils, state, e),
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::impl_has;
    use crate::model::Link;
    use crate::testing::{Fake, note};

    #[derive(Default)]
    struct State {
        id: Option<String>,
        error: Option<String>,
    }

    impl_has!(State: id, error);

    fn indexed_note() -> Fake {
        let fake = Fake::default()
            .with_note(note("a", "A", "x"))
            .with_note(note("b", "B", "y"));
        (&fake).upsert(&note("a", "A", "x"), None).unwrap();
        let link = Link {
            to_id: "a".into(),
            relation: "r".into(),
        };
        (&fake).add_links("b", &[link]).unwrap();
        fake
    }

    async fn delete(fake: &Fake) -> State {
        let mut state = State {
            id: Some("a".into()),
            ..State::default()
        };
        let Ok(()) = Delete::with_utils(fake).run(&mut state).await;
        state
    }

    #[tokio::test]
    async fn removes_file_entry_and_links_then_confirms() {
        let fake = indexed_note();

        let state = delete(&fake).await;

        assert_eq!(state.error, None);
        assert_eq!(fake.file("a"), None);
        assert!(fake.file("b").is_some());
        assert!(!fake.indexed.lock().unwrap().contains_key("a"));
        assert!(fake.links.lock().unwrap().is_empty());
        assert_eq!(fake.printed_json(), json!({"id":"a","deleted":true}));
    }

    #[tokio::test]
    async fn prints_an_error_and_keeps_the_index_when_the_file_cannot_be_removed() {
        let fake = Fake {
            fail_notes: true,
            ..indexed_note()
        };

        let state = delete(&fake).await;

        assert_eq!(
            state.error.as_deref(),
            Some("could not remove note a: disk is broken")
        );
        assert_eq!(
            fake.printed_json()["error"],
            "could not remove note a: disk is broken"
        );
        assert!(fake.indexed.lock().unwrap().contains_key("a"));
    }

    #[tokio::test]
    async fn prints_an_error_when_the_index_rejects_the_delete() {
        let fake = Fake {
            fail_index: true,
            ..indexed_note()
        };

        let state = delete(&fake).await;

        assert_eq!(state.error.as_deref(), Some("index is broken"));
        assert_eq!(fake.printed_json()["error"], "index is broken");
        assert_eq!(fake.file("a"), None, "the file goes first");
    }
}
