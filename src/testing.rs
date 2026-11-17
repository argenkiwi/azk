//! An in-memory stand-in for the outside world, scripted per test.

use crate::model::{GraphLink, Hit, Link, Note, body_hash};
use crate::utils::{Clock, Embedder, Index, NoteStore, Out, Stdin};
use std::collections::BTreeMap;
use std::io;
use std::sync::Mutex;

/// A stored index entry: the body hash and the vector, if any.
type Entry = (String, Option<Vec<f32>>);

#[derive(Default)]
pub struct Fake {
    pub stdin: Option<String>,
    /// What the embeddings host answers; `None` is unreachable.
    pub vector: Option<Vec<f32>>,
    pub keyword_hits: Vec<Hit>,
    pub semantic_hits: Vec<Hit>,
    /// Index writes (upsert, links, delete, prune) fail.
    pub fail_index: bool,
    /// Index reads (hashes, links, searches) fail.
    pub fail_index_reads: bool,
    /// Every note file operation fails.
    pub fail_notes: bool,
    pub files: Mutex<BTreeMap<String, Note>>,
    /// Per indexed id: the body hash and stored vector.
    pub indexed: Mutex<BTreeMap<String, Entry>>,
    pub links: Mutex<Vec<GraphLink>>,
    pub embedded: Mutex<Vec<String>>,
    pub printed: Mutex<Vec<String>>,
    pub eprinted: Mutex<Vec<String>>,
    pub ids: Mutex<u32>,
}

pub fn note(id: &str, title: &str, body: &str) -> Note {
    Note {
        id: id.into(),
        title: title.into(),
        tags: Vec::new(),
        created: "2026-01-01T00:00:00.000Z".into(),
        updated: "2026-01-01T00:00:00.000Z".into(),
        links: Vec::new(),
        body: body.into(),
    }
}

impl Fake {
    pub fn with_note(self, note: Note) -> Self {
        self.files.lock().unwrap().insert(note.id.clone(), note);
        self
    }

    pub fn printed(&self) -> Vec<String> {
        self.printed.lock().unwrap().clone()
    }

    pub fn eprinted(&self) -> Vec<String> {
        self.eprinted.lock().unwrap().clone()
    }

    pub fn printed_json(&self) -> serde_json::Value {
        let printed = self.printed();
        assert_eq!(printed.len(), 1, "expected one JSON value, got {printed:?}");
        serde_json::from_str(&printed[0]).unwrap()
    }

    pub fn file(&self, id: &str) -> Option<Note> {
        self.files.lock().unwrap().get(id).cloned()
    }

    pub fn stored_vector(&self, id: &str) -> Option<Vec<f32>> {
        self.indexed
            .lock()
            .unwrap()
            .get(id)
            .and_then(|(_, v)| v.clone())
    }
}

impl Out for &Fake {
    fn print(&self, message: &str) {
        self.printed.lock().unwrap().push(message.into());
    }
    fn eprint(&self, message: &str) {
        self.eprinted.lock().unwrap().push(message.into());
    }
}

impl Stdin for &Fake {
    fn read_stdin(&self) -> io::Result<String> {
        self.stdin
            .clone()
            .ok_or_else(|| io::ErrorKind::UnexpectedEof.into())
    }
}

impl Clock for &Fake {
    fn timestamp(&self) -> String {
        "2026-02-02T00:00:00.000Z".into()
    }
    fn new_id(&self) -> String {
        let mut n = self.ids.lock().unwrap();
        *n += 1;
        format!("new{n}")
    }
}

impl NoteStore for &Fake {
    fn read(&self, id: &str) -> io::Result<Option<Note>> {
        if self.fail_notes {
            return Err(io::Error::other("disk is broken"));
        }
        Ok(self.file(id))
    }
    fn write(&self, note: &Note) -> io::Result<()> {
        if self.fail_notes {
            return Err(io::Error::other("disk is broken"));
        }
        self.files
            .lock()
            .unwrap()
            .insert(note.id.clone(), note.clone());
        Ok(())
    }
    fn list(&self) -> io::Result<Vec<String>> {
        if self.fail_notes {
            return Err(io::Error::other("disk is broken"));
        }
        Ok(self.files.lock().unwrap().keys().cloned().collect())
    }
    fn remove(&self, id: &str) -> io::Result<()> {
        if self.fail_notes {
            return Err(io::Error::other("disk is broken"));
        }
        self.files.lock().unwrap().remove(id);
        Ok(())
    }
}

impl Embedder for &Fake {
    fn embed(&self, text: &str) -> Option<Vec<f32>> {
        self.embedded.lock().unwrap().push(text.into());
        self.vector.clone()
    }
}

impl Index for &Fake {
    fn upsert(&self, note: &Note, embedding: Option<&[f32]>) -> Result<(), String> {
        if self.fail_index {
            return Err("index is broken".into());
        }
        let mut indexed = self.indexed.lock().unwrap();
        let kept = indexed.get(&note.id).and_then(|(_, v)| v.clone());
        let vector = embedding.map(<[f32]>::to_vec).or(kept);
        indexed.insert(note.id.clone(), (body_hash(&note.body), vector));
        Ok(())
    }
    fn indexed_hash(&self, id: &str) -> Result<Option<String>, String> {
        if self.fail_index_reads {
            return Err("index is unreadable".into());
        }
        Ok(self.indexed.lock().unwrap().get(id).map(|(h, _)| h.clone()))
    }
    fn add_links(&self, from: &str, links: &[Link]) -> Result<(), String> {
        if self.fail_index {
            return Err("index is broken".into());
        }
        let mut stored = self.links.lock().unwrap();
        for link in links {
            let link = GraphLink {
                from_id: from.into(),
                to_id: link.to_id.clone(),
                relation: link.relation.clone(),
            };
            if !stored.contains(&link) {
                stored.push(link);
            }
        }
        Ok(())
    }
    fn replace_links(&self, from: &str, links: &[Link]) -> Result<(), String> {
        if self.fail_index {
            return Err("index is broken".into());
        }
        self.links.lock().unwrap().retain(|l| l.from_id != from);
        self.add_links(from, links)
    }
    fn links_for(&self, id: &str) -> Result<Vec<GraphLink>, String> {
        if self.fail_index_reads {
            return Err("index is unreadable".into());
        }
        let stored = self.links.lock().unwrap();
        Ok(stored
            .iter()
            .filter(|l| l.from_id == id || l.to_id == id)
            .cloned()
            .collect())
    }
    fn delete(&self, id: &str) -> Result<(), String> {
        if self.fail_index {
            return Err("index is broken".into());
        }
        self.indexed.lock().unwrap().remove(id);
        self.links
            .lock()
            .unwrap()
            .retain(|l| l.from_id != id && l.to_id != id);
        Ok(())
    }
    fn keyword_search(&self, _query: &str, _limit: usize) -> Result<Vec<Hit>, String> {
        if self.fail_index_reads {
            return Err("index is unreadable".into());
        }
        Ok(self.keyword_hits.clone())
    }
    fn semantic_search(&self, _vector: &[f32], _limit: usize) -> Result<Vec<Hit>, String> {
        if self.fail_index_reads {
            return Err("index is unreadable".into());
        }
        Ok(self.semantic_hits.clone())
    }
    fn prune(&self, keep: &[String]) -> Result<usize, String> {
        if self.fail_index {
            return Err("index is broken".into());
        }
        let mut indexed = self.indexed.lock().unwrap();
        let before = indexed.len();
        indexed.retain(|id, _| keep.contains(id));
        Ok(before - indexed.len())
    }
}

impl Fake {
    /// Overwrites a note file behind the index's back, like a hand-edit.
    pub fn write_for_test(&self, note: Note) {
        self.files.lock().unwrap().insert(note.id.clone(), note);
    }
}

/// A search hit for `id`, titled after it.
pub fn hit(id: &str, score: f64) -> Hit {
    Hit {
        id: id.into(),
        title: id.into(),
        tags: Vec::new(),
        created: String::new(),
        score,
    }
}
