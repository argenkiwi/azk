use crate::Node;
use crate::nodes::{HasEmbedding, HasError, HasNote, fail};
use crate::utils::{Index, Out};
use std::convert::Infallible;

/// Where [`IndexUpsert`] leaves the walk.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    Indexed,
    /// The index rejected the note; the error was printed.
    Failed,
}

/// Upserts the note into the index, hashing its body so a later reindex can tell it changed.
///
/// Shared by `create`, `update` and `reindex`. No embedding leaves any stored vector alone.
#[derive(Clone, Debug, Default)]
pub struct IndexUpsert<U> {
    utils: U,
}

impl<U> IndexUpsert<U> {
    #[must_use]
    pub fn with_utils(utils: U) -> Self {
        Self { utils }
    }
}

impl<S, U> Node<S> for IndexUpsert<U>
where
    S: HasNote + HasEmbedding + HasError + Send,
    U: Index + Out + Sync,
{
    type Outcome = Outcome;
    type Error = Infallible;

    async fn run(&self, state: &mut S) -> Result<Outcome, Infallible> {
        let Some(note) = state.note().clone() else {
            fail(&self.utils, state, "no note to index".into());
            return Ok(Outcome::Failed);
        };
        match self.utils.upsert(&note, state.embedding().as_deref()) {
            Ok(()) => Ok(Outcome::Indexed),
            Err(e) => {
                fail(&self.utils, state, e);
                Ok(Outcome::Failed)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::impl_has;
    use crate::model::{Note, body_hash};
    use crate::testing::{Fake, note};

    #[derive(Default)]
    struct State {
        note: Option<Note>,
        text_to_embed: Option<String>,
        embedding: Option<Vec<f32>>,
        error: Option<String>,
    }

    impl_has!(State: note, embedding, error);

    async fn upsert(
        fake: &Fake,
        note: Option<Note>,
        embedding: Option<Vec<f32>>,
    ) -> (Outcome, State) {
        let mut state = State {
            note,
            embedding,
            ..State::default()
        };
        let Ok(outcome) = IndexUpsert::with_utils(fake).run(&mut state).await;
        (outcome, state)
    }

    #[tokio::test]
    async fn indexes_the_note_with_its_hash_and_vector() {
        let fake = Fake::default();

        let (outcome, state) = upsert(&fake, Some(note("a", "A", "body")), Some(vec![1.0])).await;

        assert_eq!(outcome, Outcome::Indexed);
        assert_eq!(state.error, None);
        assert_eq!((&fake).indexed_hash("a").unwrap(), Some(body_hash("body")));
        assert_eq!(fake.stored_vector("a"), Some(vec![1.0]));
    }

    #[tokio::test]
    async fn keeps_the_stored_vector_without_an_embedding() {
        let fake = Fake::default();
        (&fake)
            .upsert(&note("a", "A", "old"), Some(&[2.0]))
            .unwrap();

        let (outcome, _) = upsert(&fake, Some(note("a", "A2", "old")), None).await;

        assert_eq!(outcome, Outcome::Indexed);
        assert_eq!(fake.stored_vector("a"), Some(vec![2.0]));
    }

    #[tokio::test]
    async fn prints_an_error_without_a_note() {
        let fake = Fake::default();

        let (outcome, state) = upsert(&fake, None, None).await;

        assert_eq!(outcome, Outcome::Failed);
        assert_eq!(state.error.as_deref(), Some("no note to index"));
        assert_eq!(fake.printed_json()["error"], "no note to index");
    }

    #[tokio::test]
    async fn prints_an_error_when_the_index_rejects_the_note() {
        let fake = Fake {
            fail_index: true,
            ..Fake::default()
        };

        let (outcome, state) = upsert(&fake, Some(note("a", "A", "body")), None).await;

        assert_eq!(outcome, Outcome::Failed);
        assert_eq!(state.error.as_deref(), Some("index is broken"));
        assert_eq!(fake.printed_json()["error"], "index is broken");
    }
}
