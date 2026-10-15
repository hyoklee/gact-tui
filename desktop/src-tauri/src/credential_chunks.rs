//! Long credentials stay in the OS keyring. Each chunk fits Windows' UTF-16 byte limit.
//! A new generation is staged before publishing its manifest; failed chunk or manifest
//! writes leave the previous credential readable. Plain secrets and v1 manifests remain readable.

use std::sync::Mutex;

const MAX_SLOT_UNITS: usize = 1000;
const MAX_CHUNKS: usize = 64;
const MANIFEST_PREFIX: &str = "gact-chunked:v2:";
static STORAGE_LOCK: Mutex<()> = Mutex::new(());

/// One named value in an operating-system credential store.
pub trait SecretSlots {
    fn get(&self, account: &str) -> Result<Option<String>, String>;
    fn set(&self, account: &str, secret: &str) -> Result<(), String>;
    /// Removing an absent slot is not an error.
    fn remove(&self, account: &str) -> Result<(), String>;
}

struct Manifest {
    generation: Option<String>,
    count: usize,
}

impl Manifest {
    fn account(&self, account: &str, index: usize) -> String {
        match &self.generation {
            Some(generation) => format!("{account}#{generation}#{index}"),
            None => format!("{account}#{index}"),
        }
    }
    fn value(&self) -> String {
        format!(
            "{MANIFEST_PREFIX}{}:{}",
            self.generation.as_deref().unwrap(),
            self.count
        )
    }
    fn remove(&self, slots: &dyn SecretSlots, account: &str) -> Result<(), String> {
        for index in 0..self.count {
            slots.remove(&self.account(account, index))?;
        }
        Ok(())
    }
}

fn damaged() -> String {
    "The stored credential is damaged; save it again.".to_string()
}

fn parse_manifest(value: &str) -> Result<Option<Manifest>, String> {
    let (generation, count) = if let Some(rest) = value.strip_prefix(MANIFEST_PREFIX) {
        let (generation, count) = rest.split_once(':').ok_or_else(damaged)?;
        if generation.len() != 32
            || !generation
                .chars()
                .all(|character| character.is_ascii_hexdigit())
        {
            return Err(damaged());
        }
        (Some(generation.to_string()), count)
    } else if let Some(count) = value.strip_prefix("gact-chunked:v1:") {
        (None, count)
    } else if value.starts_with("gact-chunked:") {
        return Err(damaged());
    } else {
        return Ok(None);
    };
    let count = count.parse::<usize>().map_err(|_| damaged())?;
    if !(1..=MAX_CHUNKS).contains(&count) {
        return Err(damaged());
    }
    Ok(Some(Manifest { generation, count }))
}

fn split(secret: &str) -> Result<Vec<String>, String> {
    let mut chunks = Vec::new();
    let mut current = String::new();
    let mut units = 0;
    for character in secret.chars() {
        if units + character.len_utf16() > MAX_SLOT_UNITS {
            chunks.push(std::mem::take(&mut current));
            units = 0;
        }
        units += character.len_utf16();
        current.push(character);
    }
    if !current.is_empty() {
        chunks.push(current);
    }
    if chunks.len() > MAX_CHUNKS {
        return Err("The credential is too large to store securely.".to_string());
    }
    Ok(chunks)
}

/// Save a complete credential, publishing the new generation only after every chunk exists.
pub fn save(slots: &dyn SecretSlots, account: &str, secret: &str) -> Result<(), String> {
    let _guard = STORAGE_LOCK
        .lock()
        .map_err(|_| "Credential storage lock is unavailable.")?;
    if secret.is_empty() {
        return Err("An empty credential cannot be stored.".to_string());
    }
    let previous = slots
        .get(account)?
        .and_then(|value| parse_manifest(&value).ok().flatten());
    let chunks = split(secret)?;
    if chunks.len() == 1 && !secret.starts_with("gact-chunked:") {
        slots.set(account, secret)?;
    } else {
        let next = Manifest {
            generation: Some(format!("{:032x}", rand::random::<u128>())),
            count: chunks.len(),
        };
        let staged = (|| {
            for (index, chunk) in chunks.iter().enumerate() {
                slots.set(&next.account(account, index), chunk)?;
            }
            slots.set(account, &next.value())
        })();
        if let Err(error) = staged {
            next.remove(slots, account).map_err(|cleanup| {
                format!("{error}; staged credential cleanup failed: {cleanup}")
            })?;
            return Err(error);
        }
    }
    if let Some(previous) = previous {
        previous.remove(slots, account)?;
    }
    Ok(())
}

/// Read the complete credential, preserving plain and legacy chunked keyring entries.
pub fn load(slots: &dyn SecretSlots, account: &str) -> Result<Option<String>, String> {
    let _guard = STORAGE_LOCK
        .lock()
        .map_err(|_| "Credential storage lock is unavailable.")?;
    let Some(value) = slots.get(account)? else {
        return Ok(None);
    };
    let Some(manifest) = parse_manifest(&value)? else {
        return Ok(Some(value));
    };
    let mut secret = String::new();
    for index in 0..manifest.count {
        match slots.get(&manifest.account(account, index))? {
            Some(chunk) => secret.push_str(&chunk),
            None => return Err("The stored credential is incomplete; save it again.".to_string()),
        }
    }
    Ok(Some(secret))
}

/// Remove the published credential before removing its now-unreachable chunk generation.
pub fn delete(slots: &dyn SecretSlots, account: &str) -> Result<(), String> {
    let _guard = STORAGE_LOCK
        .lock()
        .map_err(|_| "Credential storage lock is unavailable.")?;
    let previous = slots
        .get(account)?
        .and_then(|value| parse_manifest(&value).ok().flatten());
    slots.remove(account)?;
    if let Some(previous) = previous {
        previous.remove(slots, account)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::collections::HashMap;

    /// In-memory store that rejects oversized values like Windows Credential Manager does.
    #[derive(Default)]
    struct MemorySlots(RefCell<HashMap<String, String>>);

    impl SecretSlots for MemorySlots {
        fn get(&self, account: &str) -> Result<Option<String>, String> {
            Ok(self.0.borrow().get(account).cloned())
        }
        fn set(&self, account: &str, secret: &str) -> Result<(), String> {
            if secret.encode_utf16().count() * 2 > 2560 {
                return Err("longer than platform limit".to_string());
            }
            self.0
                .borrow_mut()
                .insert(account.to_string(), secret.to_string());
            Ok(())
        }
        fn remove(&self, account: &str) -> Result<(), String> {
            self.0.borrow_mut().remove(account);
            Ok(())
        }
    }

    fn jwt_sized(length: usize) -> String {
        (0..length)
            .map(|i| (b'a' + (i % 26) as u8) as char)
            .collect()
    }

    #[test]
    fn short_secret_is_stored_directly() {
        let slots = MemorySlots::default();
        save(&slots, "acct", "short-key").unwrap();
        assert_eq!(slots.0.borrow().len(), 1);
        assert_eq!(load(&slots, "acct").unwrap().as_deref(), Some("short-key"));
    }

    #[test]
    fn jwt_sized_secret_round_trips() {
        let slots = MemorySlots::default();
        let token = jwt_sized(3000);
        save(&slots, "acct", &token).unwrap();
        assert_eq!(load(&slots, "acct").unwrap(), Some(token));
        assert_eq!(slots.0.borrow().len(), 4);
    }

    #[test]
    fn multibyte_secret_splits_on_characters() {
        let slots = MemorySlots::default();
        let token: String = "é€𝄞".chars().cycle().take(2500).collect();
        save(&slots, "acct", &token).unwrap();
        assert_eq!(load(&slots, "acct").unwrap(), Some(token));
    }

    #[test]
    fn shrinking_a_secret_removes_stale_chunks() {
        let slots = MemorySlots::default();
        save(&slots, "acct", &jwt_sized(3000)).unwrap();
        save(&slots, "acct", &jwt_sized(1500)).unwrap();
        assert_eq!(slots.0.borrow().len(), 3);
        save(&slots, "acct", "short").unwrap();
        assert_eq!(slots.0.borrow().len(), 1);
        assert_eq!(load(&slots, "acct").unwrap().as_deref(), Some("short"));
    }

    #[test]
    fn secret_that_looks_like_a_manifest_is_preserved() {
        let slots = MemorySlots::default();
        let value = "gact-chunked:v1:3";
        save(&slots, "acct", value).unwrap();
        assert_eq!(load(&slots, "acct").unwrap().as_deref(), Some(value));
    }

    #[test]
    fn missing_chunk_is_an_error_not_a_silent_none() {
        let slots = MemorySlots::default();
        save(&slots, "acct", &jwt_sized(3000)).unwrap();
        let missing = slots
            .0
            .borrow()
            .keys()
            .find(|key| key.ends_with("#1"))
            .unwrap()
            .clone();
        slots.remove(&missing).unwrap();
        assert!(load(&slots, "acct").is_err());
    }

    #[test]
    fn delete_removes_every_slot() {
        let slots = MemorySlots::default();
        save(&slots, "acct", &jwt_sized(3000)).unwrap();
        delete(&slots, "acct").unwrap();
        assert!(slots.0.borrow().is_empty());
        delete(&slots, "acct").unwrap();
    }

    #[test]
    fn legacy_chunks_remain_readable_and_are_removed_on_replacement() {
        let slots = MemorySlots::default();
        slots.set("acct#0", "legacy-").unwrap();
        slots.set("acct#1", "token").unwrap();
        slots.set("acct", "gact-chunked:v1:2").unwrap();
        assert_eq!(
            load(&slots, "acct").unwrap().as_deref(),
            Some("legacy-token")
        );
        save(&slots, "acct", &jwt_sized(4000)).unwrap();
        assert!(slots.get("acct#0").unwrap().is_none());
        assert!(slots.get("acct#1").unwrap().is_none());
        assert_eq!(load(&slots, "acct").unwrap(), Some(jwt_sized(4000)));
    }

    struct FailingSlots {
        inner: MemorySlots,
        fail_on: usize,
        writes: std::cell::Cell<usize>,
    }

    impl SecretSlots for FailingSlots {
        fn get(&self, account: &str) -> Result<Option<String>, String> {
            self.inner.get(account)
        }
        fn remove(&self, account: &str) -> Result<(), String> {
            self.inner.remove(account)
        }
        fn set(&self, account: &str, secret: &str) -> Result<(), String> {
            let writes = self.writes.get() + 1;
            self.writes.set(writes);
            if writes == self.fail_on {
                return Err("Injected keyring write failure".into());
            }
            self.inner.set(account, secret)
        }
    }

    #[test]
    fn failed_chunk_or_manifest_write_preserves_previous_complete_token() {
        for fail_on in [1, 2, 4] {
            let inner = MemorySlots::default();
            let previous = jwt_sized(4500);
            save(&inner, "acct", &previous).unwrap();
            let count = inner.0.borrow().len();
            let slots = FailingSlots {
                inner,
                fail_on,
                writes: std::cell::Cell::new(0),
            };
            assert!(save(&slots, "acct", &jwt_sized(3000)).is_err());
            assert_eq!(load(&slots, "acct").unwrap(), Some(previous));
            assert_eq!(slots.inner.0.borrow().len(), count);
        }
    }

    #[test]
    fn supplementary_unicode_and_size_boundaries_round_trip_without_oversized_slots() {
        for length in [999, 1000, 1001, 2501, 8000] {
            let slots = MemorySlots::default();
            let secret = "𝄞".repeat(length);
            save(&slots, "acct", &secret).unwrap();
            assert_eq!(load(&slots, "acct").unwrap(), Some(secret));
            assert!(slots
                .0
                .borrow()
                .values()
                .all(|value| value.encode_utf16().count() * 2 <= 2560));
        }
    }
}
