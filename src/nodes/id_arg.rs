use crate::Node;
use crate::nodes::{HasArgs, HasId, HasUsage, HasVerb};
use std::convert::Infallible;

/// Where [`IdArg`] leaves the walk.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    /// An id was given and is now in the state.
    Given,
    /// No id; the usage message is queued.
    Missing,
}

/// Reads a note id from the first argument.
///
/// Shared by `get`, `update` and `delete`: the default usage line is built from the verb the walk
/// seeded, and a walk with other needs (like `update`'s stdin) supplies its own.
#[derive(Clone, Debug, Default)]
pub struct IdArg {
    usage: Option<String>,
}

impl IdArg {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    #[must_use]
    pub fn with_usage(usage: impl Into<String>) -> Self {
        Self {
            usage: Some(usage.into()),
        }
    }
}

impl<S> Node<S> for IdArg
where
    S: HasArgs + HasVerb + HasId + HasUsage + Send,
{
    type Outcome = Outcome;
    type Error = Infallible;

    async fn run(&self, state: &mut S) -> Result<Outcome, Infallible> {
        match state.args().first().cloned() {
            Some(id) => {
                *state.id_mut() = Some(id);
                Ok(Outcome::Given)
            }
            None => {
                let usage = self
                    .usage
                    .clone()
                    .unwrap_or_else(|| format!("Usage: azk {} <id>", state.verb()));
                *state.usage_mut() = Some(usage);
                Ok(Outcome::Missing)
            }
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
        verb: String,
        id: Option<String>,
        usage: Option<String>,
    }

    impl_has!(State: args, verb, id, usage);

    async fn id_arg(node: IdArg, args: &[&str]) -> (Outcome, State) {
        let mut state = State {
            args: args.iter().map(|a| (*a).to_string()).collect(),
            verb: "get".into(),
            ..State::default()
        };
        let Ok(outcome) = node.run(&mut state).await;
        (outcome, state)
    }

    #[tokio::test]
    async fn reads_the_id_when_given() {
        let (outcome, state) = id_arg(IdArg::new(), &["a", "extra"]).await;

        assert_eq!(outcome, Outcome::Given);
        assert_eq!(state.id.as_deref(), Some("a"));
        assert_eq!(state.usage, None);
    }

    #[tokio::test]
    async fn queues_usage_built_from_the_verb_when_missing() {
        let (outcome, state) = id_arg(IdArg::new(), &[]).await;

        assert_eq!(outcome, Outcome::Missing);
        assert_eq!(state.usage.as_deref(), Some("Usage: azk get <id>"));
        assert_eq!(state.id, None);
    }

    #[tokio::test]
    async fn queues_the_supplied_usage_when_missing() {
        let (outcome, state) = id_arg(IdArg::with_usage("custom"), &[]).await;

        assert_eq!(outcome, Outcome::Missing);
        assert_eq!(state.usage.as_deref(), Some("custom"));
    }
}
