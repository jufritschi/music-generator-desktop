//! Source songs for cover generations, stored inside the library root.
use crate::{
    audio_import::AUDIO_EXTENSIONS,
    error::{message, Result},
};
use std::path::{Path, PathBuf};

const MAX_BYTES: usize = 60 * 1024 * 1024;

fn dir(root: &Path) -> PathBuf {
    root.join("covers")
}

/// Only names created by `save` are accepted: a UUID-style stem and a known audio extension.
pub fn valid_name(name: &str) -> bool {
    let Some((stem, extension)) = name.rsplit_once('.') else {
        return false;
    };
    !stem.is_empty()
        && stem.len() <= 64
        && stem.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
        && AUDIO_EXTENSIONS.contains(&extension.to_ascii_lowercase().as_str())
}

pub fn save(root: &Path, data: &[u8], filename: &str) -> Result<String> {
    if data.is_empty() || data.len() > MAX_BYTES {
        return Err(message("audio_size"));
    }
    let extension = filename
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase();
    if !AUDIO_EXTENSIONS.contains(&extension.as_str()) {
        return Err(message("audio_type"));
    }
    let folder = dir(root);
    std::fs::create_dir_all(&folder).map_err(|_| message("Could not store the source song"))?;
    let name = format!("{}.{}", uuid::Uuid::new_v4().simple(), extension);
    std::fs::write(folder.join(&name), data)
        .map_err(|_| message("Could not store the source song"))?;
    Ok(name)
}

pub fn read(root: &Path, name: &str) -> Result<Vec<u8>> {
    if !valid_name(name) {
        return Err(message("Choose a source song for the cover"));
    }
    std::fs::read(dir(root).join(name))
        .map_err(|_| message("The source song is no longer available"))
}

#[cfg(test)]
mod tests {
    use super::valid_name;

    #[test]
    fn accepts_generated_names_only() {
        assert!(valid_name("3f2a9c1e0b7d4a8f9e6c5b4a3d2e1f0a.wav"));
        assert!(valid_name("abc.MP3"));
        assert!(!valid_name("../secret.wav"));
        assert!(!valid_name("a/b.wav"));
        assert!(!valid_name("song.exe"));
        assert!(!valid_name(".wav"));
        assert!(!valid_name(""));
    }
}
