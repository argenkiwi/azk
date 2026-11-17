use crate::Node;
use crate::nodes::{HasError, HasLinks, fail};
use crate::utils::{Index, Out};
use std::convert::Infallible;

/// Where [`CreateLinks`] leaves the walk.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    /// Recorded, or there was nothing to record.
    Recorded,
    /// The index rejected the links; the error was printed.
    Failed,
}

/// Records the pending links in the index's link graph, pointing out of `from_id`.
///
/// Shared by `create` and `link`.
#[derive(Clone, Debug, Default)]
pub struct CreateLinks<U> {
    utils: U,
}

impl<U> CreateLinks<U> {
    #[must_use]
    pub fn with_utils(utils: U) -> Self {
        Self { utils }
    }
}

impl<S, U> Node<S> for CreateLinks<U>
where
    S: HasLinks + HasError + Send,
    U: Index + Out + Sync,
{
    type Outcome = Outcome;
    type Error = Infallible;

    async fn run(&self, state: &mut S) -> Result<Outcome, Infallible> {
        let Some(from) = state.source_id().clone() else {
            fail(&self.utils, state, "no source note for the links".into());
            return Ok(Outcome::Failed);
        };
        match self.utils.add_links(&from, state.links()) {
            Ok(()) => Ok(Outcome::Recorded),
            Err(e) => {
                fail(&self.utils, state, e);
                Ok(Outcome::Failed)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::impl_has;
    use crate::model::{GraphLink, Link};
    use crate::testing::Fake;

    #[derive(Default)]
    struct State {
        error: Option<String>,
        from_id: Option<String>,
        links: Vec<Link>,
    }

    impl_has!(State: error, links);

    fn pending(from: Option<&str>) -> State {
        State {
            from_id: from.map(str::to_string),
            links: vec![Link {
                to_id: "b".into(),
                relation: "r".into(),
            }],
            ..State::default()
        }
    }

    #[tokio::test]
    async fn records_the_links_out_of_the_source() {
        let fake = Fake::default();
        let mut state = pending(Some("a"));

        let Ok(outcome) = CreateLinks::with_utils(&fake).run(&mut state).await;

        assert_eq!(outcome, Outcome::Recorded);
        assert_eq!(
            *fake.links.lock().unwrap(),
            [GraphLink {
                from_id: "a".into(),
                to_id: "b".into(),
                relation: "r".into()
            }]
        );
        assert!(fake.printed().is_empty());
    }

    #[tokio::test]
    async fn prints_an_error_without_a_source_note() {
        let fake = Fake::default();
        let mut state = pending(None);

        let Ok(outcome) = CreateLinks::with_utils(&fake).run(&mut state).await;

        assert_eq!(outcome, Outcome::Failed);
        assert_eq!(state.error.as_deref(), Some("no source note for the links"));
        assert_eq!(fake.printed_json()["error"], "no source note for the links");
        assert!(fake.links.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn prints_an_error_when_the_index_rejects_the_links() {
        let fake = Fake {
            fail_index: true,
            ..Fake::default()
        };
        let mut state = pending(Some("a"));

        let Ok(outcome) = CreateLinks::with_utils(&fake).run(&mut state).await;

        assert_eq!(outcome, Outcome::Failed);
        assert_eq!(state.error.as_deref(), Some("index is broken"));
        assert_eq!(fake.printed_json()["error"], "index is broken");
    }
}
