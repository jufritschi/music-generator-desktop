use super::Backend;
use std::{
    fs::File,
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
};

/// The byte boundary is captured immediately before each individual spawn attempt.
pub struct BackendLog {
    path: PathBuf,
    offset: u64,
    pending: Vec<u8>,
    pub(super) synthesis: Option<(Backend, String)>,
    pub(super) language: Option<(Backend, String)>,
    pub(super) cuda_failed: bool,
}

impl BackendLog {
    pub fn capture(path: &Path) -> Self {
        Self {
            path: path.to_owned(),
            offset: path.metadata().map(|m| m.len()).unwrap_or(0),
            pending: Vec::new(),
            synthesis: None,
            language: None,
            cuda_failed: false,
        }
    }

    pub(super) fn refresh(&mut self) {
        let Ok(mut file) = File::open(&self.path) else {
            return;
        };
        let Ok(metadata) = file.metadata() else {
            return;
        };
        if metadata.len() < self.offset {
            self.offset = 0;
            self.pending.clear();
            self.synthesis = None;
            self.language = None;
            self.cuda_failed = false;
        }
        if file.seek(SeekFrom::Start(self.offset)).is_err() {
            return;
        }
        let mut bytes = Vec::new();
        if file.take(256 * 1024).read_to_end(&mut bytes).is_err() {
            return;
        }
        self.offset += bytes.len() as u64;
        let mut input = std::mem::take(&mut self.pending);
        input.extend(bytes);
        let mut lines = input.split_inclusive(|&byte| byte == b'\n');
        for line in lines.by_ref() {
            if line.last() == Some(&b'\n') {
                self.observe(String::from_utf8_lossy(line).trim());
            } else if line.len() <= 4096 {
                self.pending.extend(line);
            }
        }
    }

    fn observe(&mut self, line: &str) {
        // Loading a plugin or enumerating GPUs is not evidence of model execution.
        if let Some((role, rest)) = line
            .strip_prefix("[Load] ")
            .and_then(|line| line.split_once(" backend: "))
        {
            if let Some(device) = rest.split_whitespace().next() {
                let backend = if device.starts_with("CUDA") {
                    Backend::Cuda
                } else if device.starts_with("Vulkan") {
                    Backend::Vulkan
                } else if device.starts_with("Metal") || device.starts_with("MTL") {
                    Backend::Metal
                } else if device == "CPU" {
                    Backend::Cpu
                } else {
                    Backend::Unknown
                };
                let observation = Some((backend, device.to_owned()));
                match role {
                    "LM" => self.language = observation,
                    "DiT" => self.synthesis = observation,
                    _ => {}
                }
            }
        }
        let lower = line.to_ascii_lowercase();
        let initialization_failed = lower.contains("ggml_cuda_init:")
            && ["failed", "error", "no cuda-capable device"]
                .iter()
                .any(|text| lower.contains(text));
        let plugin_failed = lower.starts_with("load_backend:")
            && lower.contains("ggml-cuda")
            && ["failed to load", "failed to initialize backend from"]
                .iter()
                .any(|text| lower.contains(text));
        if initialization_failed || plugin_failed {
            self.cuda_failed = true;
        }
    }
}
