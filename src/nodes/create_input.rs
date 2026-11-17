use crate::Node;
use crate::model::Link;
use crate::nodes::{HasFields, HasLinks, HasUsage};
use crate::utils::Stdin;
use serde_json::Value;
use std::convert::Infallible;

/// Where [`CreateInput`] leaves the walk.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    Valid,
    /// Malformed JSON, or no `title` or `body`; the usage message is queued.
    Invalid,
}

/// Reads `{ title, body, tags?, links? }` as JSON on stdin, for `create`.
#[derive(Clone, Debug, Default)]
pub struct CreateInput<U> {
    utils: U,
}

impl<U> CreateInput<U> {
    #[must_use]
    pub fn with_utils(utils: U) -> Self {
        Self { utils }
    }
}

const INVALID_JSON: &str = r#"{"error":"invalid JSON on stdin"}"#;
const REQUIRED: &str = r#"{"error":"title and body are required"}"#;

fn strings(value: &Value) -> Option<Vec<String>> {
    value
        .as_array()?
        .iter()
        .map(|v| v.as_str().map(str::to_string))
        .collect()
}

impl<S, U> Node<S> for CreateInput<U>
where
    S: HasFields + HasLinks + HasUsage + Send,
    U: Stdin + Sync,
{
    type Outcome = Outcome;
    type Error = Infallible;

    async fn run(&self, state: &mut S) -> Result<Outcome, Infallible> {
        let parsed = self
            .utils
            .read_stdin()
            .ok()
            .and_then(|text| serde_json::from_str::<Value>(&text).ok())
            .filter(Value::is_object);
        let Some(json) = parsed else {
            *state.usage_mut() = Some(INVALID_JSON.into());
            return Ok(Outcome::Invalid);
        };
        let (Some(title), Some(body)) = (json["title"].as_str(), json["body"].as_str()) else {
            *state.usage_mut() = Some(REQUIRED.into());
            return Ok(Outcome::Invalid);
        };
        let links = match json.get("links") {
            None | Some(Value::Null) => Some(Vec::new()),
            Some(v) => serde_json::from_value::<Vec<Link>>(v.clone()).ok(),
        };
        let Some(links) = links else {
            *state.usage_mut() = Some(INVALID_JSON.into());
            return Ok(Outcome::Invalid);
        };
        *state.title_mut() = Some(title.to_string());
        *state.body_mut() = Some(body.to_string());
        *state.tags_mut() = Some(json.get("tags").and_then(strings).unwrap_or_default());
        *state.links_mut() = links;
        Ok(Outcome::Valid)
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
        from_id: Option<String>,
        links: Vec<Link>,
    }

    impl_has!(State: usage, fields, links);

    async fn input(stdin: Option<&str>) -> (Outcome, State) {
        let fake = Fake {
            stdin: stdin.map(str::to_string),
            ..Fake::default()
        };
        let mut state = State::default();
        let Ok(outcome) = CreateInput::with_utils(&fake).run(&mut state).await;
        (outcome, state)
    }

    #[tokio::test]
    async fn reads_every_field_when_valid() {
        let (outcome, state) = input(Some(
            r#"{"title":"T","body":"B","tags":["x"],"links":[{"toId":"o","relation":"r"}]}"#,
        ))
        .await;

        assert_eq!(outcome, Outcome::Valid);
        assert_eq!(state.title.as_deref(), Some("T"));
        assert_eq!(state.body.as_deref(), Some("B"));
        assert_eq!(state.tags, Some(vec!["x".to_string()]));
        assert_eq!(
            state.links,
            [Link {
                to_id: "o".into(),
                relation: "r".into()
            }]
        );
        assert_eq!(state.usage, None);
    }

    #[tokio::test]
    async fn defaults_tags_and_links_to_empty_when_absent() {
        let (outcome, state) = input(Some(r#"{"title":"T","body":"B","links":null}"#)).await;

        assert_eq!(outcome, Outcome::Valid);
        assert_eq!(state.tags, Some(Vec::new()));
        assert!(state.links.is_empty());
    }

    #[tokio::test]
    async fn drops_tags_that_are_not_all_strings() {
        let (outcome, state) = input(Some(r#"{"title":"T","body":"B","tags":["x",1]}"#)).await;

        assert_eq!(outcome, Outcome::Valid);
        assert_eq!(state.tags, Some(Vec::new()));
    }

    #[tokio::test]
    async fn queues_invalid_json_usage_when_stdin_is_unreadable() {
        let (outcome, state) = input(None).await;

        assert_eq!(outcome, Outcome::Invalid);
        assert_eq!(state.usage.as_deref(), Some(INVALID_JSON));
    }

    #[tokio::test]
    async fn queues_invalid_json_usage_when_malformed() {
        let (outcome, state) = input(Some("not json")).await;

        assert_eq!(outcome, Outcome::Invalid);
        assert_eq!(state.usage.as_deref(), Some(INVALID_JSON));
    }

    #[tokio::test]
    async fn queues_invalid_json_usage_when_not_an_object() {
        let (outcome, state) = input(Some(r#"["title","body"]"#)).await;

        assert_eq!(outcome, Outcome::Invalid);
        assert_eq!(state.usage.as_deref(), Some(INVALID_JSON));
    }

    #[tokio::test]
    async fn queues_required_usage_when_body_is_missing() {
        let (outcome, state) = input(Some(r#"{"title":"T"}"#)).await;

        assert_eq!(outcome, Outcome::Invalid);
        assert_eq!(state.usage.as_deref(), Some(REQUIRED));
        assert_eq!(state.title, None);
    }

    #[tokio::test]
    async fn queues_invalid_json_usage_when_links_are_malformed() {
        let (outcome, state) =
            input(Some(r#"{"title":"T","body":"B","links":[{"to":"o"}]}"#)).await;

        assert_eq!(outcome, Outcome::Invalid);
        assert_eq!(state.usage.as_deref(), Some(INVALID_JSON));
        assert_eq!(state.title, None);
    }
}
