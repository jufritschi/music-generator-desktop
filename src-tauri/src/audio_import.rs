use crate::error::{message, Result};
use std::{io::Read, path::Path};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

const MAX_AUDIO_BYTES: u64 = 60 * 1024 * 1024;
pub const AUDIO_EXTENSIONS: &[&str] = &["wav", "mp3", "flac", "m4a", "ogg"];

#[derive(Debug, serde::Serialize)]
pub struct AudioSelection {
    pub name: String,
    pub directory: String,
    pub data: Vec<u8>,
}

/// Read only the native dialog result; never expose an arbitrary-path reader over IPC.
pub fn read_selection(path: &Path) -> Result<AudioSelection> {
    let extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !AUDIO_EXTENSIONS.contains(&extension.as_str()) {
        return Err(message("audio_type"));
    }
    if !std::fs::metadata(path)
        .map_err(|_| message("audio_read"))?
        .is_file()
    {
        return Err(message("audio_type"));
    }
    let file = std::fs::File::open(path).map_err(|_| message("audio_read"))?;
    let metadata = file.metadata().map_err(|_| message("audio_read"))?;
    if !metadata.is_file() {
        return Err(message("audio_type"));
    }
    if metadata.len() > MAX_AUDIO_BYTES {
        return Err(message("audio_size"));
    }
    let mut data = Vec::new();
    file.take(MAX_AUDIO_BYTES + 1)
        .read_to_end(&mut data)
        .map_err(|_| message("audio_read"))?;
    if data.len() as u64 > MAX_AUDIO_BYTES {
        return Err(message("audio_size"));
    }
    Ok(AudioSelection {
        name: path
            .file_name()
            .ok_or_else(|| message("audio_type"))?
            .to_string_lossy()
            .into(),
        directory: path
            .parent()
            .ok_or_else(|| message("audio_read"))?
            .to_string_lossy()
            .into(),
        data,
    })
}

#[tauri::command]
pub async fn pick_audio_file(
    app: tauri::AppHandle,
    directory: String,
    title: String,
    filter_name: String,
) -> Result<Option<AudioSelection>> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut dialog = app
            .dialog()
            .file()
            .set_directory(directory)
            .set_title(title)
            .add_filter(filter_name, AUDIO_EXTENSIONS);
        if let Some(window) = app.get_webview_window("main") {
            dialog = dialog.set_parent(&window);
        }
        let Some(selected) = dialog.blocking_pick_file() else {
            return Ok(None);
        };
        let path = selected.into_path().map_err(|_| message("audio_read"))?;
        read_selection(&path).map(Some)
    })
    .await
    .map_err(|_| message("dialog_failed"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn native_selection_reads_supported_audio_and_bounds_memory() {
        let root = tempfile::tempdir().unwrap();
        for extension in ["wav", "MP3", "flac", "m4a", "ogg"] {
            let path = root.path().join(format!("雨.{extension}"));
            std::fs::write(&path, b"RIFF").unwrap();
            let selected = read_selection(&path).unwrap();
            assert_eq!(selected.name, format!("雨.{extension}"));
            assert_eq!(selected.data, b"RIFF");
            assert_eq!(selected.directory, root.path().to_string_lossy());
        }
        let large = root.path().join("large.wav");
        let file = std::fs::File::create(&large).unwrap();
        file.set_len(60 * 1024 * 1024 + 1).unwrap();
        assert_eq!(
            read_selection(&large).unwrap_err().to_string(),
            "audio_size"
        );
        let text = root.path().join("secret.txt");
        std::fs::write(&text, b"text").unwrap();
        assert_eq!(read_selection(&text).unwrap_err().to_string(), "audio_type");
        assert_eq!(
            read_selection(&root.path().join("missing.wav"))
                .unwrap_err()
                .to_string(),
            "audio_read"
        );
    }

    #[cfg(unix)]
    #[test]
    fn native_selection_rejects_a_fifo_without_waiting_for_a_writer() {
        let root = tempfile::tempdir().unwrap();
        let fifo = root.path().join("pipe.wav");
        assert!(std::process::Command::new("mkfifo")
            .arg(&fifo)
            .status()
            .unwrap()
            .success());
        let (sender, receiver) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let _ = sender.send(read_selection(&fifo).unwrap_err().to_string());
        });
        assert_eq!(
            receiver
                .recv_timeout(std::time::Duration::from_millis(500))
                .expect("native audio reading must not block on a FIFO"),
            "audio_type"
        );
    }
}
