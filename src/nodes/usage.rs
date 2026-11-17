use crate::Node;
use crate::nodes::HasUsage;
use crate::utils::Out;
use std::convert::Infallible;

/// Prints the pending usage message to stderr. Terminal: the process then exits 1.
///
/// Shared by every walk that can be invoked badly.
#[derive(Clone, Debug, Default)]
pub struct Usage<U> {
    utils: U,
}

impl<U> Usage<U> {
    #[must_use]
    pub fn with_utils(utils: U) -> Self {
        Self { utils }
    }
}

impl<S, U> Node<S> for Usage<U>
where
    S: HasUsage + Send,
    U: Out + Sync,
{
    type Outcome = ();
    type Error = Infallible;

    async fn run(&self, state: &mut S) -> Result<(), Infallible> {
        if let Some(message) = state.usage() {
            self.utils.eprint(message);
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
        usage: Option<String>,
    }

    impl_has!(State: usage);

    #[tokio::test]
    async fn prints_the_pending_message_to_stderr() {
        let fake = Fake::default();
        let mut state = State {
            usage: Some("Usage: azk get <id>".into()),
        };

        let Ok(()) = Usage::with_utils(&fake).run(&mut state).await;

        assert_eq!(fake.eprinted(), ["Usage: azk get <id>"]);
        assert!(fake.printed().is_empty());
        assert!(state.usage.is_some(), "kept so the run exits 1");
    }

    #[tokio::test]
    async fn prints_nothing_without_a_message() {
        let fake = Fake::default();
        let mut state = State::default();

        let Ok(()) = Usage::with_utils(&fake).run(&mut state).await;

        assert!(fake.eprinted().is_empty());
    }
}
