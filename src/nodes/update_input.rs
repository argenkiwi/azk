use crate::Node;
use crate::nodes::{HasFields, HasUsage};
use crate::utils::Stdin;
use serde::Deserialize;
use std::convert::Infallible;

/// Where [`UpdateInput`] leaves the walk.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    Parsed,
    /// Malformed JSON; the usage message is queued.
    Invalid,
}

#[derive(Deserialize)]
struct Patch {
    title: Option<String>,
    body: Option<String>,
    tags: Option<Vec<String>>,
}

const INVALID_JSON: &str = r#"{"error":"invalid JSON on stdin"}"#;

/// Reads a partial `{ title?, body?, tags? }` for `update` as JSON on stdin. `{}` is a valid
/// no-op.
#[derive(Clone, Debug, Default)]
pub struct UpdateInput<U> {
    utils: U,
}

impl<U> UpdateInput<U> {
    #[must_use]
    pub fn with_utils(utils: U) -> Self {
        Self { utils }
    }
}

impl<S, U> Node<S> for UpdateInput<U>
where
    S: HasFields + HasUsage + Send,
    U: Stdin + Sync,
{
    type Outcome = Outcome;
    type Error = Infallible;

    async fn run(&self, state: &mut S) -> Result<Outcome, Infallible> {
        let patch = self
            .utils
            .read_stdin()
            .ok()
            .and_then(|text| serde_json::from_str::<Patch>(&text).ok());
        let Some(patch) = patch else {
            *state.usage_mut() = Some(INVALID_JSON.into());
            return Ok(Outcome::Invalid);
        };
        *state.title_mut() = patch.title;
        *state.body_mut() = patch.body;
        *state.tags_mut() = patch.tags;
        Ok(Outcome::Parsed)
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
        title: Option<String>,
        body: Option<String>,
        tags: Option<Vec<String>>,
    }

    impl_has!(State: usage, fields);

    async fn input(stdin: Option<&str>) -> (Outcome, State) {
        let fake = Fake {
            stdin: stdin.map(str::to_string),
            ..Fake::default()
        };
        let mut state = State::default();
        let Ok(outcome) = UpdateInput::with_utils(&fake).run(&mut state).await;
        (outcome, state)
    }

    #[tokio::test]
    async fn reads_the_supplied_fields() {
        let (outcome, state) = input(Some(r#"{"title":"T","body":"B","tags":["x"]}"#)).await;

        assert_eq!(outcome, Outcome::Parsed);
        assert_eq!(state.title.as_deref(), Some("T"));
        assert_eq!(state.body.as_deref(), Some("B"));
        assert_eq!(state.tags, Some(vec!["x".to_string()]));
    }

    #[tokio::test]
    async fn leaves_every_field_absent_for_an_empty_patch() {
        let (outcome, state) = input(Some("{}")).await;

        assert_eq!(outcome, Outcome::Parsed);
        assert_eq!((state.title, state.body, state.tags), (None, None, None));
        assert_eq!(state.usage, None);
    }

    #[tokio::test]
    async fn queues_usage_when_malformed() {
        let (outcome, state) = input(Some(r#"{"tags":"x"}"#)).await;

        assert_eq!(outcome, Outcome::Invalid);
        assert_eq!(state.usage.as_deref(), Some(INVALID_JSON));
    }

    #[tokio::test]
    async fn queues_usage_when_stdin_is_unreadable() {
        let (outcome, state) = input(None).await;

        assert_eq!(outcome, Outcome::Invalid);
        assert_eq!(state.usage.as_deref(), Some(INVALID_JSON));
    }
}
