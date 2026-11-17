use crate::Node;
use crate::nodes::{HasQueue, StoreError};
use crate::utils::NoteStore;

/// Seeds the `reindex` loop from the Markdown files on disk and zeroes the counters.
///
/// Must stay the entry node: the counters are accumulated onto downstream.
#[derive(Clone, Debug, Default)]
pub struct ReindexList<U> {
    utils: U,
}

impl<U> ReindexList<U> {
    #[must_use]
    pub fn with_utils(utils: U) -> Self {
        Self { utils }
    }
}

impl<S, U> Node<S> for ReindexList<U>
where
    S: HasQueue + Send,
    U: NoteStore + Sync,
{
    type Outcome = ();
    type Error = StoreError;

    async fn run(&self, state: &mut S) -> Result<(), StoreError> {
        let ids = self
            .utils
            .list()
            .map_err(|e| StoreError(format!("could not list notes: {e}")))?;
        state.seed(ids);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::impl_has;
    use crate::testing::{Fake, note};
    use std::collections::VecDeque;

    #[derive(Default)]
    struct State {
        all_ids: Vec<String>,
        remaining_ids: VecDeque<String>,
        indexed: usize,
        updated: usize,
        removed: usize,
        total: usize,
    }

    impl_has!(State: queue);

    #[tokio::test]
    async fn seeds_the_queue_and_zeroes_the_counters() {
        let fake = Fake::default()
            .with_note(note("a", "A", "x"))
            .with_note(note("b", "B", "y"));
        let mut state = State {
            indexed: 3,
            updated: 2,
            ..State::default()
        };

        ReindexList::with_utils(&fake)
            .run(&mut state)
            .await
            .unwrap();

        assert_eq!(state.all_ids, ["a", "b"]);
        assert_eq!(state.remaining_ids, ["a", "b"]);
        assert_eq!(state.summary(), (0, 0, 0, 2));
    }

    #[tokio::test]
    async fn fails_and_leaves_the_queue_alone_when_notes_cannot_be_listed() {
        let fake = Fake {
            fail_notes: true,
            ..Fake::default()
        };
        let mut state = State::default();

        let result = ReindexList::with_utils(&fake).run(&mut state).await;

        assert_eq!(
            result.unwrap_err().0,
            "could not list notes: disk is broken"
        );
        assert!(state.remaining_ids.is_empty());
    }
}
