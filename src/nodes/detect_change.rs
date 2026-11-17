use crate::Node;
use crate::model::body_hash;
use crate::nodes::{HasEmbedding, HasId, HasNote, HasQueue, StoreError};
use crate::utils::{Index, NoteStore};

/// Where [`DetectChange`] leaves the walk.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    Read,
    /// The file vanished between listing and reading.
    Vanished,
}

/// Reads the current `reindex` note and decides whether it needs re-embedding, by comparing its
/// body hash with the index's, counting it as newly indexed or updated.
///
/// The pending embed text is cleared when nothing changed, so one note's body can never be
/// carried into the next one's embedding.
#[derive(Clone, Debug, Default)]
pub struct DetectChange<U> {
    utils: U,
}

impl<U> DetectChange<U> {
    #[must_use]
    pub fn with_utils(utils: U) -> Self {
        Self { utils }
    }
}

impl<S, U> Node<S> for DetectChange<U>
where
    S: HasQueue + HasId + HasNote + HasEmbedding + Send,
    U: NoteStore + Index + Sync,
{
    type Outcome = Outcome;
    type Error = StoreError;

    async fn run(&self, state: &mut S) -> Result<Outcome, StoreError> {
        let id = state.id().clone().unwrap_or_default();
        let note = self
            .utils
            .read(&id)
            .map_err(|e| StoreError(format!("could not read note {id}: {e}")))?;
        let Some(note) = note else {
            *state.note_mut() = None;
            *state.text_to_embed_mut() = None;
            return Ok(Outcome::Vanished);
        };
        let stored = self.utils.indexed_hash(&id).map_err(StoreError)?;
        let changed = match stored {
            None => {
                state.count_indexed();
                true
            }
            Some(hash) if hash != body_hash(&note.body) => {
                state.count_updated();
                true
            }
            Some(_) => false,
        };
        *state.text_to_embed_mut() = changed.then(|| note.body.clone());
        *state.note_mut() = Some(note);
        Ok(Outcome::Read)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::impl_has;
    use crate::model::Note;
    use crate::testing::{Fake, note};
    use std::collections::VecDeque;

    #[derive(Default)]
    struct State {
        id: Option<String>,
        note: Option<Note>,
        text_to_embed: Option<String>,
        embedding: Option<Vec<f32>>,
        all_ids: Vec<String>,
        remaining_ids: VecDeque<String>,
        indexed: usize,
        updated: usize,
        removed: usize,
        total: usize,
    }

    impl_has!(State: id, note, embedding, queue);

    fn stale_state() -> State {
        State {
            id: Some("a".into()),
            note: Some(note("old", "Old", "old")),
            text_to_embed: Some("old".into()),
            ..State::default()
        }
    }

    async fn detect(fake: &Fake) -> (Result<Outcome, StoreError>, State) {
        let mut state = stale_state();
        let result = DetectChange::with_utils(fake).run(&mut state).await;
        (result, state)
    }

    #[tokio::test]
    async fn counts_a_new_note_as_indexed_and_queues_its_body() {
        let fake = Fake::default().with_note(note("a", "A", "body"));

        let (result, state) = detect(&fake).await;

        assert_eq!(result.unwrap(), Outcome::Read);
        assert_eq!((state.indexed, state.updated), (1, 0));
        assert_eq!(state.text_to_embed.as_deref(), Some("body"));
        assert_eq!(state.note.unwrap().id, "a");
    }

    #[tokio::test]
    async fn counts_a_changed_body_as_updated_and_queues_it() {
        let fake = Fake::default();
        (&fake).upsert(&note("a", "A", "before"), None).unwrap();
        fake.write_for_test(note("a", "A", "after"));

        let (result, state) = detect(&fake).await;

        assert_eq!(result.unwrap(), Outcome::Read);
        assert_eq!((state.indexed, state.updated), (0, 1));
        assert_eq!(state.text_to_embed.as_deref(), Some("after"));
    }

    #[tokio::test]
    async fn clears_the_embed_text_when_the_body_is_unchanged() {
        let fake = Fake::default().with_note(note("a", "A", "same"));
        (&fake).upsert(&note("a", "A", "same"), None).unwrap();

        let (result, state) = detect(&fake).await;

        assert_eq!(result.unwrap(), Outcome::Read);
        assert_eq!((state.indexed, state.updated), (0, 0));
        assert_eq!(state.text_to_embed, None);
        assert_eq!(state.note.unwrap().id, "a");
    }

    #[tokio::test]
    async fn clears_the_note_and_embed_text_when_the_file_vanished() {
        let fake = Fake::default();

        let (result, state) = detect(&fake).await;

        assert_eq!(result.unwrap(), Outcome::Vanished);
        assert_eq!(state.note, None);
        assert_eq!(state.text_to_embed, None);
    }

    #[tokio::test]
    async fn fails_and_leaves_the_state_alone_when_the_note_cannot_be_read() {
        let fake = Fake {
            fail_notes: true,
            ..Fake::default()
        };

        let (result, state) = detect(&fake).await;

        assert_eq!(
            result.unwrap_err().0,
            "could not read note a: disk is broken"
        );
        assert_eq!(state.note.unwrap().id, "old");
        assert_eq!(state.text_to_embed.as_deref(), Some("old"));
    }

    #[tokio::test]
    async fn fails_and_counts_nothing_when_the_index_cannot_be_read() {
        let fake = Fake {
            fail_index_reads: true,
            ..Fake::default()
        }
        .with_note(note("a", "A", "body"));

        let (result, state) = detect(&fake).await;

        assert_eq!(result.unwrap_err().0, "index is unreadable");
        assert_eq!((state.indexed, state.updated), (0, 0));
        assert_eq!(state.note.unwrap().id, "old");
    }
}
