//! Serialize native update calls even when more than one webview invokes IPC.
use std::sync::atomic::{AtomicBool, Ordering};

static INSTALLING: AtomicBool = AtomicBool::new(false);

pub(crate) struct UpdateLease;

impl UpdateLease {
    pub(crate) fn acquire() -> Result<Self, String> {
        INSTALLING
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map(|_| Self)
            .map_err(|_| "A CLIO update is already in progress.".to_string())
    }
}

impl Drop for UpdateLease {
    fn drop(&mut self) {
        INSTALLING.store(false, Ordering::Release);
    }
}

#[cfg(test)]
mod tests {
    use super::UpdateLease;
    #[test]
    fn update_lease_excludes_a_second_worker_and_releases_on_failure() {
        let first = UpdateLease::acquire().unwrap();
        assert!(std::thread::spawn(UpdateLease::acquire)
            .join()
            .unwrap()
            .is_err());
        drop(first);
        assert!(UpdateLease::acquire().is_ok());
    }
}
