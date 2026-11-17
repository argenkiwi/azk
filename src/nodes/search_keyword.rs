use crate::Node;
use crate::nodes::{HasEmbedding, HasSearch, StoreError, by_position};
use crate::utils::Index;

/// Runs the `search` full-text query and queues the query for embedding.
///
/// An empty result is not a dead end: semantic search can still surface notes sharing no keywords.
#[derive(Clone, Debug, Default)]
pub struct SearchKeyword<U> {
    utils: U,
}

impl<U> SearchKeyword<U> {
    #[must_use]
    pub fn with_utils(utils: U) -> Self {
        Self { utils }
    }
}

impl<S, U> Node<S> for SearchKeyword<U>
where
    S: HasSearch + HasEmbedding + Send,
    U: Index + Sync,
{
    type Outcome = ();
    type Error = StoreError;

    async fn run(&self, state: &mut S) -> Result<(), StoreError> {
        let hits = self
            .utils
            .keyword_search(state.query(), state.limit())
            .map_err(StoreError)?;
        state.set_keyword_results(by_position(hits));
        *state.text_to_embed_mut() = Some(state.query().to_string());
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::impl_has;
    use crate::model::Hit;
    use crate::testing::{Fake, hit};

    #[derive(Default)]
    struct State {
        query: Option<String>,
        limit: Option<usize>,
        keyword_results: Vec<Hit>,
        semantic_results: Vec<Hit>,
        text_to_embed: Option<String>,
        embedding: Option<Vec<f32>>,
    }

    impl_has!(State: search, embedding);

    async fn keyword(fake: &Fake) -> (Result<(), StoreError>, State) {
        let mut state = State {
            query: Some("cats".into()),
            ..State::default()
        };
        let result = SearchKeyword::with_utils(fake).run(&mut state).await;
        (result, state)
    }

    #[tokio::test]
    async fn scores_hits_by_position_and_queues_the_query() {
        let fake = Fake {
            keyword_hits: vec![hit("a", 9.0), hit("b", 9.0)],
            ..Fake::default()
        };

        let (result, state) = keyword(&fake).await;

        result.unwrap();
        let scored: Vec<_> = state
            .keyword_results
            .iter()
            .map(|h| (h.id.as_str(), h.score))
            .collect();
        assert_eq!(scored, [("a", 1.0 / 61.0), ("b", 1.0 / 62.0)]);
        assert_eq!(state.text_to_embed.as_deref(), Some("cats"));
    }

    #[tokio::test]
    async fn still_queues_the_query_when_nothing_matches() {
        let fake = Fake::default();

        let (result, state) = keyword(&fake).await;

        result.unwrap();
        assert!(state.keyword_results.is_empty());
        assert_eq!(state.text_to_embed.as_deref(), Some("cats"));
    }

    #[tokio::test]
    async fn fails_and_queues_nothing_when_the_index_cannot_be_read() {
        let fake = Fake {
            fail_index_reads: true,
            ..Fake::default()
        };

        let (result, state) = keyword(&fake).await;

        assert_eq!(result.unwrap_err().0, "index is unreadable");
        assert_eq!(state.text_to_embed, None);
    }
}
