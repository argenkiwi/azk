use crate::Node;
use crate::nodes::{HasLinkArgs, HasLinks, print_json};
use crate::utils::Out;
use serde_json::json;
use std::convert::Infallible;

/// Prints the `link` confirmation. Terminal.
#[derive(Clone, Debug, Default)]
pub struct LinkFinish<U> {
    utils: U,
}

impl<U> LinkFinish<U> {
    #[must_use]
    pub fn with_utils(utils: U) -> Self {
        Self { utils }
    }
}

impl<S, U> Node<S> for LinkFinish<U>
where
    S: HasLinks + HasLinkArgs + Send,
    U: Out + Sync,
{
    type Outcome = ();
    type Error = Infallible;

    async fn run(&self, state: &mut S) -> Result<(), Infallible> {
        print_json(
            &self.utils,
            &json!({
                "fromId": state.source_id(),
                "toId": state.to_id(),
                "relation": state.relation(),
                "linked": true,
            }),
        );
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::impl_has;
    use crate::model::Link;
    use crate::testing::Fake;

    #[derive(Default)]
    struct State {
        from_id: Option<String>,
        to_id: Option<String>,
        relation: Option<String>,
        links: Vec<Link>,
    }

    impl_has!(State: links, link_args);

    #[tokio::test]
    async fn prints_the_confirmation() {
        let fake = Fake::default();
        let mut state = State {
            from_id: Some("a".into()),
            to_id: Some("b".into()),
            relation: Some("r".into()),
            ..State::default()
        };

        let Ok(()) = LinkFinish::with_utils(&fake).run(&mut state).await;

        assert_eq!(
            fake.printed_json(),
            json!({"fromId":"a","toId":"b","relation":"r","linked":true})
        );
    }
}
