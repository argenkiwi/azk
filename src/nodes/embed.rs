use crate::Node;
use crate::nodes::HasEmbedding;
use crate::utils::Embedder;
use std::convert::Infallible;

/// Embeds the pending text, if any. Never fails.
///
/// Shared by `search`, `create`, `update` and `reindex`. An unreachable host, or nothing queued,
/// yields no vector — written on every pass so a previous note's vector is never left behind.
/// `INDEX_UPSERT` reads no vector as "leave the stored one alone".
#[derive(Clone, Debug, Default)]
pub struct Embed<U> {
    utils: U,
}

impl<U> Embed<U> {
    #[must_use]
    pub fn with_utils(utils: U) -> Self {
        Self { utils }
    }
}

impl<S, U> Node<S> for Embed<U>
where
    S: HasEmbedding + Send,
    U: Embedder + Sync,
{
    type Outcome = ();
    type Error = Infallible;

    async fn run(&self, state: &mut S) -> Result<(), Infallible> {
        let vector = state
            .text_to_embed()
            .as_deref()
            .and_then(|text| self.utils.embed(text));
        *state.embedding_mut() = vector;
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
        text_to_embed: Option<String>,
        embedding: Option<Vec<f32>>,
    }

    impl_has!(State: embedding);

    async fn embed(fake: &Fake, text: Option<&str>) -> State {
        let mut state = State {
            text_to_embed: text.map(str::to_string),
            embedding: Some(vec![9.0]),
        };
        let Ok(()) = Embed::with_utils(fake).run(&mut state).await;
        state
    }

    #[tokio::test]
    async fn stores_the_vector_for_the_pending_text() {
        let fake = Fake {
            vector: Some(vec![1.0, 0.0]),
            ..Fake::default()
        };

        let state = embed(&fake, Some("hello")).await;

        assert_eq!(state.embedding, Some(vec![1.0, 0.0]));
        assert_eq!(*fake.embedded.lock().unwrap(), ["hello"]);
    }

    #[tokio::test]
    async fn clears_the_vector_when_the_host_is_unreachable() {
        let fake = Fake::default();

        let state = embed(&fake, Some("hello")).await;

        assert_eq!(state.embedding, None);
    }

    #[tokio::test]
    async fn clears_the_vector_without_calling_the_host_when_nothing_is_pending() {
        let fake = Fake {
            vector: Some(vec![1.0]),
            ..Fake::default()
        };

        let state = embed(&fake, None).await;

        assert_eq!(state.embedding, None);
        assert!(fake.embedded.lock().unwrap().is_empty());
    }
}
