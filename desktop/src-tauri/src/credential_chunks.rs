//! Chunked secret storage on top of a single-value credential store.
//!
//! Windows Credential Manager rejects a secret larger than 2560 bytes (the `keyring` crate checks
//! the UTF-16 encoding, so roughly 1280 characters). Long bearer tokens such as JWT personal access
//! tokens exceed that. A secret over [`MAX_SLOT_CHARS`] is split across numbered slots and the main
//! slot holds a manifest, so shorter secrets are stored exactly as before and need no migration.

const MAX_SLOT_CHARS: usize = 1000;
const MAX_CHUNKS: usize = 64;
const MANIFEST_PREFIX: &str = "gact-chunked:v1:";

/// One named value in an operating-system credential store.
pub trait SecretSlots {
    fn get(&self, account: &str) -> Result<Option<String>, String>;
    fn set(&self, account: &str, secret: &str) -> Result<(), String>;
    /// Removing an absent slot is not an error.
    fn remove(&self, account: &str) -> Result<(), String>;
}

fn chunk_account(account: &str, index: usize) -> String {
    format!("{account}#{index}")
}

fn manifest(count: usize) -> String {
    format!("{MANIFEST_PREFIX}{count}")
}

/// `Ok(None)` for a plain secret, `Ok(Some(n))` for a manifest, `Err` for a damaged manifest.
fn parse_manifest(value: &str) -> Result<Option<usize>, String> {
    let Some(count) = value.strip_prefix(MANIFEST_PREFIX) else {
        return Ok(None);
    };
    match count.parse::<usize>() {
        Ok(count) if (1..=MAX_CHUNKS).contains(&count) => Ok(Some(count)),
        _ => Err("The stored credential is damaged; save it again.".to_string()),
    }
}

/// Store `secret` under `account`, chunking it when it does not fit one slot.
pub fn save(slots: &dyn SecretSlots, account: &str, secret: &str) -> Result<(), String> {
    let previous = match slots.get(account)? {
        Some(value) => parse_manifest(&value).unwrap_or(None).unwrap_or(0),
        None => 0,
    };
    let characters: Vec<char> = secret.chars().collect();
    let count = if characters.len() <= MAX_SLOT_CHARS && !secret.starts_with(MANIFEST_PREFIX) {
        slots.set(account, secret)?;
        0
    } else {
        let chunks: Vec<String> = characters
            .chunks(MAX_SLOT_CHARS)
            .map(|chunk| chunk.iter().collect())
            .collect();
        if chunks.len() > MAX_CHUNKS {
            return Err("The credential is too large to store securely.".to_string());
        }
        for (index, chunk) in chunks.iter().enumerate() {
            slots.set(&chunk_account(account, index), chunk)?;
        }
        // The manifest goes last so an interrupted save never points at missing chunks.
        slots.set(account, &manifest(chunks.len()))?;
        chunks.len()
    };
    for index in count..previous {
        slots.remove(&chunk_account(account, index))?;
    }
    Ok(())
}

/// Read the secret stored under `account`, reassembling chunks when present.
pub fn load(slots: &dyn SecretSlots, account: &str) -> Result<Option<String>, String> {
    let Some(value) = slots.get(account)? else {
        return Ok(None);
    };
    let Some(count) = parse_manifest(&value)? else {
        return Ok(Some(value));
    };
    let mut secret = String::new();
    for index in 0..count {
        match slots.get(&chunk_account(account, index))? {
            Some(chunk) => secret.push_str(&chunk),
            None => return Err("The stored credential is incomplete; save it again.".to_string()),
        }
    }
    Ok(Some(secret))
}

/// Delete the secret under `account` together with any chunks.
pub fn delete(slots: &dyn SecretSlots, account: &str) -> Result<(), String> {
    if let Some(value) = slots.get(account)? {
        let count = parse_manifest(&value).unwrap_or(None).unwrap_or(0);
        for index in 0..count {
            slots.remove(&chunk_account(account, index))?;
        }
    }
    slots.remove(account)
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
            self.0.borrow_mut().insert(account.to_string(), secret.to_string());
            Ok(())
        }
        fn remove(&self, account: &str) -> Result<(), String> {
            self.0.borrow_mut().remove(account);
            Ok(())
        }
    }

    fn jwt_sized(length: usize) -> String {
        (0..length).map(|i| (b'a' + (i % 26) as u8) as char).collect()
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
        slots.remove("acct#1").unwrap();
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
}
