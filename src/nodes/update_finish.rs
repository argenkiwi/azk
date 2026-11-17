use crate::Node;
use crate::nodes::{HasId, print_json};
use crate::utils::Out;
use serde_json::json;
use std::convert::Infallible;

/// Prints the `update` confirmation. Terminal.
#[derive(Clone, Debug, Default)]
pub struct UpdateFinish<U> {
    utils: U,
}

impl<U> UpdateFinish<U> {
    #[must_use]
    pub fn with_utils(utils: U) -> Self {
        Self { utils }
    }
}

impl<S, U> Node<S> for UpdateFinish<U>
where
    S: HasId + Send,
    U: Out + Sync,
{
    type Outcome = ();
    type Error = Infallible;

    async fn run(&self, state: &mut S) -> Result<(), Infallible> {
        let id = state.id().clone().unwrap_or_default();
        print_json(&self.utils, &json!({ "id": id, "updated": true }));
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
        id: Option<String>,
    }

    impl_has!(State: id);

    #[tokio::test]
    async fn prints_the_confirmation() {
        let fake = Fake::default();
        let mut state = State {
            id: Some("a".into()),
        };

        let Ok(()) = UpdateFinish::with_utils(&fake).run(&mut state).await;

        assert_eq!(fake.printed_json(), json!({"id":"a","updated":true}));
    }
}
