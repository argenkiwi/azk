use crate::Node;
use crate::nodes::{HasId, HasQueue};
use std::convert::Infallible;

/// Where [`ReindexNext`] leaves the walk.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    Note,
    Done,
}

/// Takes the next note id off the `reindex` queue. The only node that decides how long the
/// reindex runs.
#[derive(Clone, Debug, Default)]
pub struct ReindexNext;

impl<S> Node<S> for ReindexNext
where
    S: HasQueue + HasId + Send,
{
    type Outcome = Outcome;
    type Error = Infallible;

    async fn run(&self, state: &mut S) -> Result<Outcome, Infallible> {
        let next = state.take_next();
        let outcome = if next.is_some() {
            Outcome::Note
        } else {
            Outcome::Done
        };
        *state.id_mut() = next;
        Ok(outcome)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::impl_has;
    use std::collections::VecDeque;

    #[derive(Default)]
    struct State {
        id: Option<String>,
        all_ids: Vec<String>,
        remaining_ids: VecDeque<String>,
        indexed: usize,
        updated: usize,
        removed: usize,
        total: usize,
    }

    impl_has!(State: id, queue);

    #[tokio::test]
    async fn takes_the_next_id_off_the_queue() {
        let mut state = State {
            remaining_ids: ["a".to_string(), "b".to_string()].into(),
            ..State::default()
        };

        let Ok(outcome) = ReindexNext.run(&mut state).await;

        assert_eq!(outcome, Outcome::Note);
        assert_eq!(state.id.as_deref(), Some("a"));
        assert_eq!(state.remaining_ids, ["b"]);
    }

    #[tokio::test]
    async fn is_done_and_clears_the_id_when_the_queue_is_empty() {
        let mut state = State {
            id: Some("last".into()),
            ..State::default()
        };

        let Ok(outcome) = ReindexNext.run(&mut state).await;

        assert_eq!(outcome, Outcome::Done);
        assert_eq!(state.id, None);
    }
}
