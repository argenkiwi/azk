use crate::Node;
use crate::nodes::{HasArgs, HasTopic, HasUsage, guide, verbs};
use std::convert::Infallible;

/// Where [`HelpInput`] leaves the walk.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    Known,
    /// A verb azk doesn't have; the usage message is queued.
    Unknown,
}

/// Reads the optional verb for `help` from the first argument, case-insensitively.
#[derive(Clone, Debug, Default)]
pub struct HelpInput;

impl<S> Node<S> for HelpInput
where
    S: HasArgs + HasTopic + HasUsage + Send,
{
    type Outcome = Outcome;
    type Error = Infallible;

    async fn run(&self, state: &mut S) -> Result<Outcome, Infallible> {
        let topic = state
            .args()
            .first()
            .map_or_else(|| "general".to_string(), |verb| verb.to_lowercase());
        if guide(&topic).is_some() {
            state.set_topic(topic);
            Ok(Outcome::Known)
        } else {
            *state.usage_mut() = Some(format!("Usage: azk help [{}]", verbs().join("|")));
            Ok(Outcome::Unknown)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::impl_has;

    #[derive(Default)]
    struct State {
        args: Vec<String>,
        usage: Option<String>,
        topic: String,
    }

    impl_has!(State: args, usage, topic);

    async fn input(args: &[&str]) -> (Outcome, State) {
        let mut state = State {
            args: args.iter().map(|a| (*a).to_string()).collect(),
            ..State::default()
        };
        let Ok(outcome) = HelpInput.run(&mut state).await;
        (outcome, state)
    }

    #[tokio::test]
    async fn picks_general_when_no_verb_is_given() {
        let (outcome, state) = input(&[]).await;

        assert_eq!(outcome, Outcome::Known);
        assert_eq!(state.topic, "general");
    }

    #[tokio::test]
    async fn picks_a_known_verb_case_insensitively() {
        let (outcome, state) = input(&["SEARCH"]).await;

        assert_eq!(outcome, Outcome::Known);
        assert_eq!(state.topic, "search");
        assert_eq!(state.usage, None);
    }

    #[tokio::test]
    async fn queues_usage_listing_the_verbs_when_unknown() {
        let (outcome, state) = input(&["frobnicate"]).await;

        assert_eq!(outcome, Outcome::Unknown);
        assert_eq!(
            state.usage.as_deref(),
            Some("Usage: azk help [search|create|get|update|delete|link|reindex|help]")
        );
        assert_eq!(state.topic, "");
    }
}
