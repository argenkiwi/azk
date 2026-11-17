use crate::Node;
use crate::nodes::{HasArgs, HasLinkArgs, HasLinks, HasUsage};
use std::convert::Infallible;

/// Where [`LinkInput`] leaves the walk.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    Given,
    /// Fewer than three arguments; the usage message is queued.
    Missing,
}

/// Reads the source id, target id and relation phrase for `link` from the arguments.
#[derive(Clone, Debug, Default)]
pub struct LinkInput;

impl<S> Node<S> for LinkInput
where
    S: HasArgs + HasLinks + HasLinkArgs + HasUsage + Send,
{
    type Outcome = Outcome;
    type Error = Infallible;

    async fn run(&self, state: &mut S) -> Result<Outcome, Infallible> {
        let [from, to, relation, ..] = state.args() else {
            *state.usage_mut() = Some(r#"Usage: azk link <fromId> <toId> "<relation>""#.into());
            return Ok(Outcome::Missing);
        };
        let (from, to, relation) = (from.clone(), to.clone(), relation.clone());
        *state.source_id_mut() = Some(from);
        *state.to_id_mut() = Some(to);
        *state.relation_mut() = Some(relation);
        Ok(Outcome::Given)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::impl_has;
    use crate::model::Link;

    #[derive(Default)]
    struct State {
        args: Vec<String>,
        usage: Option<String>,
        from_id: Option<String>,
        to_id: Option<String>,
        relation: Option<String>,
        links: Vec<Link>,
    }

    impl_has!(State: args, usage, links, link_args);

    async fn input(args: &[&str]) -> (Outcome, State) {
        let mut state = State {
            args: args.iter().map(|a| (*a).to_string()).collect(),
            ..State::default()
        };
        let Ok(outcome) = LinkInput.run(&mut state).await;
        (outcome, state)
    }

    #[tokio::test]
    async fn reads_both_ends_and_the_relation_when_given() {
        let (outcome, state) = input(&["a", "b", "builds on"]).await;

        assert_eq!(outcome, Outcome::Given);
        assert_eq!(state.from_id.as_deref(), Some("a"));
        assert_eq!(state.to_id.as_deref(), Some("b"));
        assert_eq!(state.relation.as_deref(), Some("builds on"));
        assert_eq!(state.usage, None);
    }

    #[tokio::test]
    async fn queues_usage_when_an_argument_is_missing() {
        let (outcome, state) = input(&["a", "b"]).await;

        assert_eq!(outcome, Outcome::Missing);
        assert_eq!(
            state.usage.as_deref(),
            Some(r#"Usage: azk link <fromId> <toId> "<relation>""#)
        );
        assert_eq!(state.from_id, None);
    }
}
