use crate::Node;
use crate::model::{Note, NoteLink};
use crate::nodes::{HasEmbedding, HasFields, HasLinks, HasNote};
use crate::utils::Clock;
use std::convert::Infallible;

/// Assembles the new note in memory, for `create`: fresh id, matching timestamps, links in
/// frontmatter form.
///
/// Links are not validated here, unlike the `link` walk: a missing target is a dangling link.
#[derive(Clone, Debug, Default)]
pub struct CreateInit<U> {
    utils: U,
}

impl<U> CreateInit<U> {
    #[must_use]
    pub fn with_utils(utils: U) -> Self {
        Self { utils }
    }
}

impl<S, U> Node<S> for CreateInit<U>
where
    S: HasFields + HasLinks + HasNote + HasEmbedding + Send,
    U: Clock + Sync,
{
    type Outcome = ();
    type Error = Infallible;

    async fn run(&self, state: &mut S) -> Result<(), Infallible> {
        let id = self.utils.new_id();
        let now = self.utils.timestamp();
        let body = state.body().clone().unwrap_or_default();
        *state.note_mut() = Some(Note {
            id: id.clone(),
            title: state.title().clone().unwrap_or_default(),
            tags: state.tags().clone().unwrap_or_default(),
            created: now.clone(),
            updated: now,
            links: state.links().iter().map(NoteLink::from).collect(),
            body: body.clone(),
        });
        *state.source_id_mut() = Some(id);
        *state.text_to_embed_mut() = Some(body);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::impl_has;
    use crate::model::Link;
    use crate::testing::Fake;

    #[derive(Default)]
    struct State {
        title: Option<String>,
        body: Option<String>,
        tags: Option<Vec<String>>,
        from_id: Option<String>,
        links: Vec<Link>,
        note: Option<Note>,
        text_to_embed: Option<String>,
        embedding: Option<Vec<f32>>,
    }

    impl_has!(State: fields, links, note, embedding);

    #[tokio::test]
    async fn assembles_the_note_and_queues_its_body_for_embedding() {
        let fake = Fake::default();
        let mut state = State {
            title: Some("T".into()),
            body: Some("B".into()),
            tags: Some(vec!["x".into()]),
            links: vec![Link {
                to_id: "o".into(),
                relation: "r".into(),
            }],
            ..State::default()
        };

        let Ok(()) = CreateInit::with_utils(&fake).run(&mut state).await;

        let note = state.note.unwrap();
        assert_eq!(note.id, "new1");
        assert_eq!((note.title.as_str(), note.body.as_str()), ("T", "B"));
        assert_eq!(note.tags, ["x"]);
        assert_eq!(note.created, "2026-02-02T00:00:00.000Z");
        assert_eq!(note.created, note.updated);
        assert_eq!(
            note.links,
            [NoteLink {
                to: "o".into(),
                relation: "r".into()
            }]
        );
        assert_eq!(state.from_id.as_deref(), Some("new1"));
        assert_eq!(state.text_to_embed.as_deref(), Some("B"));
    }
}
