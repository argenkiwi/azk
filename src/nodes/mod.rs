use crate::model::{Hit, Link, Note};

pub mod create_finish;
pub mod create_init;
pub mod create_input;
pub mod create_links;
pub mod delete;
pub mod detect_change;
pub mod embed;
pub mod exists_check;
pub mod get;
pub mod help_input;
pub mod help_print;
pub mod id_arg;
pub mod index_upsert;
pub mod link_finish;
pub mod link_input;
pub mod link_validate;
pub mod merge_rank;
pub mod prune_orphans;
pub mod reindex_finish;
pub mod reindex_list;
pub mod reindex_next;
pub mod replace_links;
pub mod search_input;
pub mod search_keyword;
pub mod search_semantic;
pub mod update_finish;
pub mod update_input;
pub mod update_merge;
pub mod usage;
pub mod write_note;

/// A failure of the index or notes directory that the walk reports as `{ "error": ... }`.
#[derive(Debug, thiserror::Error)]
#[error("{0}")]
pub struct StoreError(pub String);

/// The message `USAGE` prints. Its presence is what makes the run exit 1.
pub trait HasUsage {
    fn usage_mut(&mut self) -> &mut Option<String>;
    fn usage(&self) -> &Option<String>;
}

/// The message a failing node already printed.
pub trait HasError {
    fn error_mut(&mut self) -> &mut Option<String>;
}

/// The verb's arguments from the command line, and the verb itself.
pub trait HasArgs {
    fn args(&self) -> &[String];
}

pub trait HasVerb {
    fn verb(&self) -> &str;
}

/// The id of the note being worked on.
pub trait HasId {
    fn id(&self) -> &Option<String>;
    fn id_mut(&mut self) -> &mut Option<String>;
}

pub trait HasNote {
    fn note(&self) -> &Option<Note>;
    fn note_mut(&mut self) -> &mut Option<Note>;
}

/// Text queued for embedding and the vector it produced.
pub trait HasEmbedding {
    fn text_to_embed(&self) -> &Option<String>;
    fn text_to_embed_mut(&mut self) -> &mut Option<String>;
    fn embedding(&self) -> &Option<Vec<f32>>;
    fn embedding_mut(&mut self) -> &mut Option<Vec<f32>>;
}

/// Links to record in the index, pointing out of `from_id`.
pub trait HasLinks {
    fn source_id(&self) -> &Option<String>;
    fn source_id_mut(&mut self) -> &mut Option<String>;
    fn links(&self) -> &[Link];
    fn links_mut(&mut self) -> &mut Vec<Link>;
}

/// The caller's `title`, `body` and `tags`, each absent when not supplied.
pub trait HasFields {
    fn title(&self) -> &Option<String>;
    fn title_mut(&mut self) -> &mut Option<String>;
    fn body(&self) -> &Option<String>;
    fn body_mut(&mut self) -> &mut Option<String>;
    fn tags(&self) -> &Option<Vec<String>>;
    fn tags_mut(&mut self) -> &mut Option<Vec<String>>;
}

/// `general`, or the verb whose guide to print.
pub trait HasTopic {
    fn topic(&self) -> &str;
    fn set_topic(&mut self, topic: String);
}

/// The link being made: `from_id` (see [`HasLinks`]) points at `to_id` with `relation`.
pub trait HasLinkArgs {
    fn to_id(&self) -> &Option<String>;
    fn to_id_mut(&mut self) -> &mut Option<String>;
    fn relation(&self) -> &Option<String>;
    fn relation_mut(&mut self) -> &mut Option<String>;
}

/// The queue of notes to reindex and the counters accumulated while draining it.
pub trait HasQueue {
    /// Replaces the queue and zeroes the counters.
    fn seed(&mut self, ids: Vec<String>);
    /// Every note on disk, as listed at the start.
    fn all_ids(&self) -> &[String];
    /// Takes the next id off the queue.
    fn take_next(&mut self) -> Option<String>;
    fn count_indexed(&mut self);
    fn count_updated(&mut self);
    fn set_removed(&mut self, removed: usize);
    /// `(indexed, updated, removed, total)`
    fn summary(&self) -> (usize, usize, usize, usize);
}

/// The query, how many results to return, and the two rankings awaiting the blend.
pub trait HasSearch {
    fn query(&self) -> &str;
    fn set_query(&mut self, query: String);
    fn limit(&self) -> usize;
    fn set_limit(&mut self, limit: usize);
    fn keyword_results(&self) -> &[Hit];
    fn set_keyword_results(&mut self, hits: Vec<Hit>);
    fn semantic_results(&self) -> &[Hit];
    fn set_semantic_results(&mut self, hits: Vec<Hit>);
}

/// Implements the state traits for a struct whose fields carry the spec's snake_case names.
///
/// `impl_has!(State: usage, error, id)` — each name is the field and selects the trait.
/// `queue`, `search`, `topic` and `link_args` expect the fields the walks' states use.
#[macro_export]
macro_rules! impl_has {
    ($state:ty: $($name:ident),+ $(,)?) => { $( $crate::impl_has!(@ $state, $name); )+ };
    (@ $s:ty, usage) => {
        impl $crate::nodes::HasUsage for $s {
            fn usage_mut(&mut self) -> &mut Option<String> { &mut self.usage }
            fn usage(&self) -> &Option<String> { &self.usage }
        }
    };
    (@ $s:ty, error) => {
        impl $crate::nodes::HasError for $s {
            fn error_mut(&mut self) -> &mut Option<String> { &mut self.error }
        }
    };
    (@ $s:ty, args) => {
        impl $crate::nodes::HasArgs for $s {
            fn args(&self) -> &[String] { &self.args }
        }
    };
    (@ $s:ty, verb) => {
        impl $crate::nodes::HasVerb for $s {
            fn verb(&self) -> &str { &self.verb }
        }
    };
    (@ $s:ty, id) => {
        impl $crate::nodes::HasId for $s {
            fn id(&self) -> &Option<String> { &self.id }
            fn id_mut(&mut self) -> &mut Option<String> { &mut self.id }
        }
    };
    (@ $s:ty, note) => {
        impl $crate::nodes::HasNote for $s {
            fn note(&self) -> &Option<$crate::model::Note> { &self.note }
            fn note_mut(&mut self) -> &mut Option<$crate::model::Note> { &mut self.note }
        }
    };
    (@ $s:ty, embedding) => {
        impl $crate::nodes::HasEmbedding for $s {
            fn text_to_embed(&self) -> &Option<String> { &self.text_to_embed }
            fn text_to_embed_mut(&mut self) -> &mut Option<String> { &mut self.text_to_embed }
            fn embedding(&self) -> &Option<Vec<f32>> { &self.embedding }
            fn embedding_mut(&mut self) -> &mut Option<Vec<f32>> { &mut self.embedding }
        }
    };
    (@ $s:ty, links) => {
        impl $crate::nodes::HasLinks for $s {
            fn source_id(&self) -> &Option<String> { &self.from_id }
            fn source_id_mut(&mut self) -> &mut Option<String> { &mut self.from_id }
            fn links(&self) -> &[$crate::model::Link] { &self.links }
            fn links_mut(&mut self) -> &mut Vec<$crate::model::Link> { &mut self.links }
        }
    };
    (@ $s:ty, fields) => {
        impl $crate::nodes::HasFields for $s {
            fn title(&self) -> &Option<String> { &self.title }
            fn title_mut(&mut self) -> &mut Option<String> { &mut self.title }
            fn body(&self) -> &Option<String> { &self.body }
            fn body_mut(&mut self) -> &mut Option<String> { &mut self.body }
            fn tags(&self) -> &Option<Vec<String>> { &self.tags }
            fn tags_mut(&mut self) -> &mut Option<Vec<String>> { &mut self.tags }
        }
    };
    (@ $s:ty, topic) => {
        impl $crate::nodes::HasTopic for $s {
            fn topic(&self) -> &str { &self.topic }
            fn set_topic(&mut self, topic: String) { self.topic = topic; }
        }
    };
    (@ $s:ty, link_args) => {
        impl $crate::nodes::HasLinkArgs for $s {
            fn to_id(&self) -> &Option<String> { &self.to_id }
            fn to_id_mut(&mut self) -> &mut Option<String> { &mut self.to_id }
            fn relation(&self) -> &Option<String> { &self.relation }
            fn relation_mut(&mut self) -> &mut Option<String> { &mut self.relation }
        }
    };
    (@ $s:ty, queue) => {
        impl $crate::nodes::HasQueue for $s {
            fn seed(&mut self, ids: Vec<String>) {
                self.total = ids.len();
                self.remaining_ids = ids.iter().cloned().collect();
                self.all_ids = ids;
                self.indexed = 0;
                self.updated = 0;
            }
            fn all_ids(&self) -> &[String] { &self.all_ids }
            fn take_next(&mut self) -> Option<String> { self.remaining_ids.pop_front() }
            fn count_indexed(&mut self) { self.indexed += 1; }
            fn count_updated(&mut self) { self.updated += 1; }
            fn set_removed(&mut self, removed: usize) { self.removed = removed; }
            fn summary(&self) -> (usize, usize, usize, usize) {
                (self.indexed, self.updated, self.removed, self.total)
            }
        }
    };
    (@ $s:ty, search) => {
        impl $crate::nodes::HasSearch for $s {
            fn query(&self) -> &str { self.query.as_deref().unwrap_or_default() }
            fn set_query(&mut self, query: String) { self.query = Some(query); }
            fn limit(&self) -> usize {
                self.limit.unwrap_or($crate::nodes::search_input::DEFAULT_LIMIT)
            }
            fn set_limit(&mut self, limit: usize) { self.limit = Some(limit); }
            fn keyword_results(&self) -> &[$crate::model::Hit] { &self.keyword_results }
            fn set_keyword_results(&mut self, hits: Vec<$crate::model::Hit>) {
                self.keyword_results = hits;
            }
            fn semantic_results(&self) -> &[$crate::model::Hit] { &self.semantic_results }
            fn set_semantic_results(&mut self, hits: Vec<$crate::model::Hit>) {
                self.semantic_results = hits;
            }
        }
    };
}

/// Prints one JSON value to stdout.
pub(crate) fn print_json(out: &impl crate::utils::Out, value: &serde_json::Value) {
    out.print(&value.to_string());
}

/// Prints `{ "error": message }` and records the message.
pub(crate) fn fail<S: HasError>(out: &impl crate::utils::Out, state: &mut S, message: String) {
    print_json(out, &serde_json::json!({ "error": message }));
    *state.error_mut() = Some(message);
}

/// The guides are compiled in, so an installed binary needs no access to its source directory.
const GUIDES: [(&str, &str); 9] = [
    ("general", include_str!("../guides/general.md")),
    ("search", include_str!("../guides/search.md")),
    ("create", include_str!("../guides/create.md")),
    ("get", include_str!("../guides/get.md")),
    ("update", include_str!("../guides/update.md")),
    ("delete", include_str!("../guides/delete.md")),
    ("link", include_str!("../guides/link.md")),
    ("reindex", include_str!("../guides/reindex.md")),
    ("help", include_str!("../guides/help.md")),
];

/// The guide for `topic` (`general` or a verb), if there is one.
pub(crate) fn guide(topic: &str) -> Option<&'static str> {
    GUIDES.iter().find(|(t, _)| *t == topic).map(|(_, g)| *g)
}

/// Every verb with a guide, in help order.
pub(crate) fn verbs() -> Vec<&'static str> {
    GUIDES.iter().skip(1).map(|(t, _)| *t).collect()
}

/// Scores hits (best first) by rank position, so the keyword and semantic rankings can be added.
pub(crate) fn by_position(hits: Vec<Hit>) -> Vec<Hit> {
    hits.into_iter()
        .enumerate()
        .map(|(position, hit)| Hit {
            score: 1.0 / (60.0 + position as f64 + 1.0),
            ..hit
        })
        .collect()
}
