use crate::Node;
use crate::nodes::{HasArgs, HasSearch, HasUsage};
use std::convert::Infallible;

/// How many results `search` returns when the caller doesn't say.
pub const DEFAULT_LIMIT: usize = 5;

/// Where [`SearchInput`] leaves the walk.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    Given,
    /// No query; the usage message is queued.
    Missing,
}

/// Reads the `search` query and an optional result limit ([`DEFAULT_LIMIT`] when unspecified or
/// not a number) from the arguments.
#[derive(Clone, Debug, Default)]
pub struct SearchInput;

impl<S> Node<S> for SearchInput
where
    S: HasArgs + HasSearch + HasUsage + Send,
{
    type Outcome = Outcome;
    type Error = Infallible;

    async fn run(&self, state: &mut S) -> Result<Outcome, Infallible> {
        let Some(query) = state.args().first().cloned() else {
            *state.usage_mut() = Some(r#"Usage: azk search "<query>" [limit]"#.into());
            return Ok(Outcome::Missing);
        };
        let limit = state
            .args()
            .get(1)
            .and_then(|l| l.parse().ok())
            .unwrap_or(DEFAULT_LIMIT);
        state.set_query(query);
        state.set_limit(limit);
        Ok(Outcome::Given)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::impl_has;
    use crate::model::Hit;

    #[derive(Default)]
    struct State {
        args: Vec<String>,
        usage: Option<String>,
        query: Option<String>,
        limit: Option<usize>,
        keyword_results: Vec<Hit>,
        semantic_results: Vec<Hit>,
    }

    impl_has!(State: args, usage, search);

    async fn input(args: &[&str]) -> (Outcome, State) {
        let mut state = State {
            args: args.iter().map(|a| (*a).to_string()).collect(),
            ..State::default()
        };
        let Ok(outcome) = SearchInput.run(&mut state).await;
        (outcome, state)
    }

    #[tokio::test]
    async fn reads_the_query_and_limit_when_given() {
        let (outcome, state) = input(&["cats", "3"]).await;

        assert_eq!(outcome, Outcome::Given);
        assert_eq!(state.query.as_deref(), Some("cats"));
        assert_eq!(state.limit, Some(3));
    }

    #[tokio::test]
    async fn defaults_the_limit_when_absent() {
        let (outcome, state) = input(&["cats"]).await;

        assert_eq!(outcome, Outcome::Given);
        assert_eq!(state.limit, Some(DEFAULT_LIMIT));
    }

    #[tokio::test]
    async fn defaults_the_limit_when_not_a_number() {
        let (outcome, state) = input(&["cats", "many"]).await;

        assert_eq!(outcome, Outcome::Given);
        assert_eq!(state.limit, Some(DEFAULT_LIMIT));
    }

    #[tokio::test]
    async fn queues_usage_when_the_query_is_missing() {
        let (outcome, state) = input(&[]).await;

        assert_eq!(outcome, Outcome::Missing);
        assert_eq!(
            state.usage.as_deref(),
            Some(r#"Usage: azk search "<query>" [limit]"#)
        );
        assert_eq!(state.query, None);
    }
}
