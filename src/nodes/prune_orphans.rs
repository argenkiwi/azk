use crate::Node;
use crate::nodes::{HasQueue, StoreError};
use crate::utils::Index;

/// Drops index entries whose Markdown file no longer exists, so a note deleted by hand
/// disappears from search. Used by `reindex`.
#[derive(Clone, Debug, Default)]
pub struct PruneOrphans<U> {
    utils: U,
}

impl<U> PruneOrphans<U> {
    #[must_use]
    pub fn with_utils(utils: U) -> Self {
        Self { utils }
    }
}

impl<S, U> Node<S> for PruneOrphans<U>
where
    S: HasQueue + Send,
    U: Index + Sync,
{
    type Outcome = ();
    type Error = StoreError;

    async fn run(&self, state: &mut S) -> Result<(), StoreError> {
        let removed = self.utils.prune(state.all_ids()).map_err(StoreError)?;
        state.set_removed(removed);
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

    fn indexed(ids: &[&str]) -> Fake {
        let fake = Fake::default();
        for id in ids {
            (&fake).upsert(&note(id, id, id), None).unwrap();
        }
        fake
    }

    fn listing(ids: &[&str]) -> State {
        State {
            all_ids: ids.iter().map(|id| (*id).to_string()).collect(),
            ..State::default()
        }
    }

    #[tokio::test]
    async fn drops_entries_without_a_file_and_counts_them() {
        let fake = indexed(&["a", "gone"]);
        let mut state = listing(&["a"]);

        PruneOrphans::with_utils(&fake)
            .run(&mut state)
            .await
            .unwrap();

        assert_eq!(state.removed, 1);
        assert!(!fake.indexed.lock().unwrap().contains_key("gone"));
        assert!(fake.indexed.lock().unwrap().contains_key("a"));
    }

    #[tokio::test]
    async fn fails_and_counts_nothing_when_the_index_rejects_the_prune() {
        let fake = Fake {
            fail_index: true,
            ..Fake::default()
        };
        let mut state = listing(&["a"]);

        let result = PruneOrphans::with_utils(&fake).run(&mut state).await;

        assert_eq!(result.unwrap_err().0, "index is broken");
        assert_eq!(state.removed, 0);
    }
}
