use crate::Node;
use crate::nodes::{HasQueue, print_json};
use crate::utils::Out;
use serde_json::json;
use std::convert::Infallible;

/// Prints the `reindex` summary. Terminal.
#[derive(Clone, Debug, Default)]
pub struct ReindexFinish<U> {
    utils: U,
}

impl<U> ReindexFinish<U> {
    #[must_use]
    pub fn with_utils(utils: U) -> Self {
        Self { utils }
    }
}

impl<S, U> Node<S> for ReindexFinish<U>
where
    S: HasQueue + Send,
    U: Out + Sync,
{
    type Outcome = ();
    type Error = Infallible;

    async fn run(&self, state: &mut S) -> Result<(), Infallible> {
        let (indexed, updated, removed, total) = state.summary();
        print_json(
            &self.utils,
            &json!({ "indexed": indexed, "updated": updated, "removed": removed, "total": total }),
        );
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::impl_has;
    use crate::testing::Fake;
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
    async fn prints_the_counters() {
        let fake = Fake::default();
        let mut state = State {
            indexed: 1,
            updated: 2,
            removed: 3,
            total: 4,
            ..State::default()
        };

        let Ok(()) = ReindexFinish::with_utils(&fake).run(&mut state).await;

        assert_eq!(
            fake.printed_json(),
            json!({"indexed":1,"updated":2,"removed":3,"total":4})
        );
    }
}
