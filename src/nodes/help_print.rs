use crate::Node;
use crate::nodes::{HasTopic, guide};
use crate::utils::Out;
use std::convert::Infallible;

/// Prints the resolved `help` guide as plain text. Terminal.
#[derive(Clone, Debug, Default)]
pub struct HelpPrint<U> {
    utils: U,
}

impl<U> HelpPrint<U> {
    #[must_use]
    pub fn with_utils(utils: U) -> Self {
        Self { utils }
    }
}

impl<S, U> Node<S> for HelpPrint<U>
where
    S: HasTopic + Send,
    U: Out + Sync,
{
    type Outcome = ();
    type Error = Infallible;

    async fn run(&self, state: &mut S) -> Result<(), Infallible> {
        if let Some(text) = guide(state.topic()) {
            self.utils.print(text.trim_end());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::impl_has;
    use crate::testing::Fake;

    #[derive(Default)]
    struct State {
        topic: String,
    }

    impl_has!(State: topic);

    async fn print(topic: &str) -> Vec<String> {
        let fake = Fake::default();
        let mut state = State {
            topic: topic.into(),
        };
        let Ok(()) = HelpPrint::with_utils(&fake).run(&mut state).await;
        fake.printed()
    }

    #[tokio::test]
    async fn prints_the_guide_without_trailing_whitespace() {
        let printed = print("get").await;

        assert_eq!(printed, [guide("get").unwrap().trim_end()]);
    }

    #[tokio::test]
    async fn prints_nothing_for_an_unknown_topic() {
        assert!(print("nope").await.is_empty());
    }
}
