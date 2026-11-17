use crate::Node;
use crate::model::Link;
use crate::nodes::{HasNote, StoreError};
use crate::utils::Index;

/// Rebuilds the current `reindex` note's outgoing links from its own frontmatter, changed or not,
/// so a hand-edit that only touched links is still picked up.
#[derive(Clone, Debug, Default)]
pub struct ReplaceLinks<U> {
    utils: U,
}

impl<U> ReplaceLinks<U> {
    #[must_use]
    pub fn with_utils(utils: U) -> Self {
        Self { utils }
    }
}

impl<S, U> Node<S> for ReplaceLinks<U>
where
    S: HasNote + Send,
    U: Index + Sync,
{
    type Outcome = ();
    type Error = StoreError;

    async fn run(&self, state: &mut S) -> Result<(), StoreError> {
        if let Some(note) = state.note() {
            let links: Vec<Link> = note.links.iter().map(Link::from).collect();
            self.utils
                .replace_links(&note.id, &links)
                .map_err(StoreError)?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::impl_has;
    use crate::model::{GraphLink, Note, NoteLink};
    use crate::testing::{Fake, note};

    #[derive(Default)]
    struct State {
        note: Option<Note>,
    }

    impl_has!(State: note);

    fn graph(from: &str, to: &str) -> GraphLink {
        GraphLink {
            from_id: from.into(),
            to_id: to.into(),
            relation: "r".into(),
        }
    }

    fn linked_note() -> Note {
        let mut a = note("a", "A", "x");
        a.links.push(NoteLink {
            to: "b".into(),
            relation: "r".into(),
        });
        a
    }

    fn with_stale_link(fake: Fake) -> Fake {
        let stale = Link {
            to_id: "gone".into(),
            relation: "r".into(),
        };
        (&fake).add_links("a", &[stale]).unwrap();
        fake
    }

    #[tokio::test]
    async fn replaces_the_outgoing_links_with_the_frontmatter_ones() {
        let fake = with_stale_link(Fake::default());
        let mut state = State {
            note: Some(linked_note()),
        };

        ReplaceLinks::with_utils(&fake)
            .run(&mut state)
            .await
            .unwrap();

        assert_eq!(*fake.links.lock().unwrap(), [graph("a", "b")]);
    }

    #[tokio::test]
    async fn does_nothing_without_a_note() {
        let fake = with_stale_link(Fake::default());
        let mut state = State::default();

        ReplaceLinks::with_utils(&fake)
            .run(&mut state)
            .await
            .unwrap();

        assert_eq!(*fake.links.lock().unwrap(), [graph("a", "gone")]);
    }

    #[tokio::test]
    async fn fails_when_the_index_rejects_the_links() {
        let fake = Fake {
            fail_index: true,
            ..Fake::default()
        };
        let mut state = State {
            note: Some(linked_note()),
        };

        let result = ReplaceLinks::with_utils(&fake).run(&mut state).await;

        assert_eq!(result.unwrap_err().0, "index is broken");
    }
}
