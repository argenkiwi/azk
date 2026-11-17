use crate::Node;
use crate::nodes::{HasError, HasNote, fail};
use crate::utils::{NoteStore, Out};
use std::convert::Infallible;

/// Where [`WriteNote`] leaves the walk.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    Written,
    /// The write failed; the error was printed.
    Failed,
}

/// Persists the note to its Markdown file — the source of truth, written before the index.
///
/// Shared by `create`, `update` and `link`.
#[derive(Clone, Debug, Default)]
pub struct WriteNote<U> {
    utils: U,
}

impl<U> WriteNote<U> {
    #[must_use]
    pub fn with_utils(utils: U) -> Self {
        Self { utils }
    }
}

impl<S, U> Node<S> for WriteNote<U>
where
    S: HasNote + HasError + Send,
    U: NoteStore + Out + Sync,
{
    type Outcome = Outcome;
    type Error = Infallible;

    async fn run(&self, state: &mut S) -> Result<Outcome, Infallible> {
        let Some(note) = state.note().clone() else {
            fail(&self.utils, state, "no note to write".into());
            return Ok(Outcome::Failed);
        };
        match self.utils.write(&note) {
            Ok(()) => Ok(Outcome::Written),
            Err(e) => {
                fail(
                    &self.utils,
                    state,
                    format!("could not write note {}: {e}", note.id),
                );
                Ok(Outcome::Failed)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::impl_has;
    use crate::model::Note;
    use crate::testing::{Fake, note};

    #[derive(Default)]
    struct State {
        note: Option<Note>,
        error: Option<String>,
    }

    impl_has!(State: note, error);

    async fn write(fake: &Fake, note: Option<Note>) -> (Outcome, State) {
        let mut state = State {
            note,
            ..State::default()
        };
        let Ok(outcome) = WriteNote::with_utils(fake).run(&mut state).await;
        (outcome, state)
    }

    #[tokio::test]
    async fn writes_the_note_file() {
        let fake = Fake::default();

        let (outcome, state) = write(&fake, Some(note("a", "A", "body"))).await;

        assert_eq!(outcome, Outcome::Written);
        assert_eq!(state.error, None);
        assert_eq!(fake.file("a"), Some(note("a", "A", "body")));
        assert!(fake.printed().is_empty());
    }

    #[tokio::test]
    async fn prints_an_error_without_a_note() {
        let fake = Fake::default();

        let (outcome, state) = write(&fake, None).await;

        assert_eq!(outcome, Outcome::Failed);
        assert_eq!(state.error.as_deref(), Some("no note to write"));
        assert_eq!(fake.printed_json()["error"], "no note to write");
    }

    #[tokio::test]
    async fn prints_an_error_when_the_write_fails() {
        let fake = Fake {
            fail_notes: true,
            ..Fake::default()
        };

        let (outcome, state) = write(&fake, Some(note("a", "A", "body"))).await;

        assert_eq!(outcome, Outcome::Failed);
        assert_eq!(
            state.error.as_deref(),
            Some("could not write note a: disk is broken")
        );
        assert_eq!(fake.file("a"), None);
    }
}
