use crate::Node;
use crate::nodes::{HasEmbedding, HasFields, HasNote};
use crate::utils::Clock;
use std::convert::Infallible;

/// Applies the `update` patch over the existing note and stamps it updated.
///
/// Queues the body for embedding **only** when one was supplied: a title or tag change would pay
/// a network round trip for a vector that wouldn't move.
#[derive(Clone, Debug, Default)]
pub struct UpdateMerge<U> {
    utils: U,
}

impl<U> UpdateMerge<U> {
    #[must_use]
    pub fn with_utils(utils: U) -> Self {
        Self { utils }
    }
}

impl<S, U> Node<S> for UpdateMerge<U>
where
    S: HasFields + HasNote + HasEmbedding + Send,
    U: Clock + Sync,
{
    type Outcome = ();
    type Error = Infallible;

    async fn run(&self, state: &mut S) -> Result<(), Infallible> {
        let (title, body, tags) = (
            state.title().clone(),
            state.body().clone(),
            state.tags().clone(),
        );
        if let Some(note) = state.note_mut() {
            if let Some(title) = title {
                note.title = title;
            }
            if let Some(tags) = tags {
                note.tags = tags;
            }
            if let Some(body) = &body {
                note.body.clone_from(body);
            }
            note.updated = self.utils.timestamp();
        }
        *state.text_to_embed_mut() = body;
        Ok(())
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
        title: Option<String>,
        body: Option<String>,
        tags: Option<Vec<String>>,
        note: Option<Note>,
        text_to_embed: Option<String>,
        embedding: Option<Vec<f32>>,
    }

    impl_has!(State: fields, note, embedding);

    async fn merge(state: &mut State) {
        let fake = Fake::default();
        let Ok(()) = UpdateMerge::with_utils(&fake).run(state).await;
    }

    #[tokio::test]
    async fn applies_every_field_and_queues_the_new_body() {
        let mut state = State {
            title: Some("T2".into()),
            body: Some("B2".into()),
            tags: Some(vec!["y".into()]),
            note: Some(note("a", "A", "B")),
            ..State::default()
        };

        merge(&mut state).await;

        let note = state.note.unwrap();
        assert_eq!((note.title.as_str(), note.body.as_str()), ("T2", "B2"));
        assert_eq!(note.tags, ["y"]);
        assert_eq!(note.updated, "2026-02-02T00:00:00.000Z");
        assert_eq!(note.created, "2026-01-01T00:00:00.000Z");
        assert_eq!(state.text_to_embed.as_deref(), Some("B2"));
    }

    #[tokio::test]
    async fn keeps_unsupplied_fields_and_queues_nothing_without_a_body() {
        let mut state = State {
            title: Some("T2".into()),
            note: Some(note("a", "A", "B")),
            text_to_embed: Some("stale".into()),
            ..State::default()
        };

        merge(&mut state).await;

        let note = state.note.unwrap();
        assert_eq!((note.title.as_str(), note.body.as_str()), ("T2", "B"));
        assert_eq!(note.updated, "2026-02-02T00:00:00.000Z");
        assert_eq!(state.text_to_embed, None);
    }
}
