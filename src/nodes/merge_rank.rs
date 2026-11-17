use crate::Node;
use crate::model::Hit;
use crate::nodes::{HasSearch, print_json};
use crate::utils::Out;
use std::collections::HashMap;
use std::convert::Infallible;

/// Blends the two `search` rankings, best match first, and prints them. Terminal.
///
/// Semantic scoring is additive: it boosts a note that also matched by keyword and admits one
/// that matched only semantically. An empty result is `[]`, not an error.
#[derive(Clone, Debug, Default)]
pub struct MergeRank<U> {
    utils: U,
}

impl<U> MergeRank<U> {
    #[must_use]
    pub fn with_utils(utils: U) -> Self {
        Self { utils }
    }
}

fn blend(keyword: &[Hit], semantic: &[Hit], limit: usize) -> Vec<Hit> {
    let mut merged: Vec<Hit> = Vec::new();
    let mut at: HashMap<&str, usize> = HashMap::new();
    for hit in keyword.iter().chain(semantic) {
        match at.get(hit.id.as_str()) {
            Some(&i) => merged[i].score += hit.score,
            None => {
                at.insert(&hit.id, merged.len());
                merged.push(hit.clone());
            }
        }
    }
    merged.sort_by(|a, b| b.score.total_cmp(&a.score));
    merged.truncate(limit);
    merged
}

impl<S, U> Node<S> for MergeRank<U>
where
    S: HasSearch + Send,
    U: Out + Sync,
{
    type Outcome = ();
    type Error = Infallible;

    async fn run(&self, state: &mut S) -> Result<(), Infallible> {
        let hits = blend(
            state.keyword_results(),
            state.semantic_results(),
            state.limit(),
        );
        print_json(&self.utils, &serde_json::json!(hits));
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::impl_has;
    use crate::nodes::by_position;
    use crate::testing::{Fake, hit};
    use serde_json::json;

    #[derive(Default)]
    struct State {
        query: Option<String>,
        limit: Option<usize>,
        keyword_results: Vec<Hit>,
        semantic_results: Vec<Hit>,
    }

    impl_has!(State: search);

    fn ranked(ids: &[&str]) -> Vec<Hit> {
        by_position(ids.iter().map(|id| hit(id, 0.0)).collect())
    }

    #[test]
    fn semantic_boosts_a_keyword_match_and_admits_new_ones() {
        let ids: Vec<_> = blend(&ranked(&["a", "b"]), &ranked(&["b", "c"]), 5)
            .into_iter()
            .map(|h| h.id)
            .collect();

        assert_eq!(ids, ["b", "a", "c"]);
    }

    #[test]
    fn blend_respects_the_limit() {
        assert_eq!(blend(&ranked(&["a", "b", "c"]), &[], 2).len(), 2);
        assert!(blend(&[], &[], 2).is_empty());
    }

    #[tokio::test]
    async fn prints_the_blended_hits_up_to_the_limit() {
        let fake = Fake::default();
        let mut state = State {
            limit: Some(1),
            keyword_results: ranked(&["a"]),
            semantic_results: ranked(&["b"]),
            ..State::default()
        };

        let Ok(()) = MergeRank::with_utils(&fake).run(&mut state).await;

        let printed = fake.printed_json();
        assert_eq!(printed.as_array().unwrap().len(), 1);
        assert_eq!(printed[0]["id"], "a");
    }

    #[tokio::test]
    async fn prints_an_empty_list_when_nothing_matched() {
        let fake = Fake::default();
        let mut state = State::default();

        let Ok(()) = MergeRank::with_utils(&fake).run(&mut state).await;

        assert_eq!(fake.printed_json(), json!([]));
    }
}
