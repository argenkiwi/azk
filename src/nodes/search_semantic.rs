use crate::Node;
use crate::nodes::{HasEmbedding, HasSearch, StoreError, by_position};
use crate::utils::Index;

/// Scores every indexed note against the `search` query vector, keeping the closest few.
///
/// Contributes nothing when the query could not be embedded, degrading to keyword-only.
#[derive(Clone, Debug, Default)]
pub struct SearchSemantic<U> {
    utils: U,
}

impl<U> SearchSemantic<U> {
    #[must_use]
    pub fn with_utils(utils: U) -> Self {
        Self { utils }
    }
}

impl<S, U> Node<S> for SearchSemantic<U>
where
    S: HasSearch + HasEmbedding + Send,
    U: Index + Sync,
{
    type Outcome = ();
    type Error = StoreError;

    async fn run(&self, state: &mut S) -> Result<(), StoreError> {
        let hits = match state.embedding() {
            Some(vector) => self
                .utils
                .semantic_search(vector, state.limit())
                .map_err(StoreError)?,
            None => Vec::new(),
        };
        state.set_semantic_results(by_position(hits));
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

    fn hits() -> Fake {
        Fake {
            semantic_hits: vec![hit("a", 0.9), hit("b", 0.8)],
            ..Fake::default()
        }
    }

    async fn semantic(fake: &Fake, embedding: Option<Vec<f32>>) -> (Result<(), StoreError>, State) {
        let mut state = State {
            embedding,
            ..State::default()
        };
        let result = SearchSemantic::with_utils(fake).run(&mut state).await;
        (result, state)
    }

    #[tokio::test]
    async fn scores_hits_by_position_when_the_query_was_embedded() {
        let fake = hits();

        let (result, state) = semantic(&fake, Some(vec![1.0])).await;

        result.unwrap();
        let scored: Vec<_> = state
            .semantic_results
            .iter()
            .map(|h| (h.id.as_str(), h.score))
            .collect();
        assert_eq!(scored, [("a", 1.0 / 61.0), ("b", 1.0 / 62.0)]);
    }

    #[tokio::test]
    async fn contributes_nothing_without_a_query_vector() {
        let fake = hits();

        let (result, state) = semantic(&fake, None).await;

        result.unwrap();
        assert!(state.semantic_results.is_empty());
    }

    #[tokio::test]
    async fn fails_when_the_index_cannot_be_read() {
        let fake = Fake {
            fail_index_reads: true,
            ..hits()
        };

        let (result, state) = semantic(&fake, Some(vec![1.0])).await;

        assert_eq!(result.unwrap_err().0, "index is unreadable");
        assert!(state.semantic_results.is_empty());
    }
}
