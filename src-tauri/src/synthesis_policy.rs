//! Model-free device detection, isolated from the GUI because GPU drivers can crash or hang.
use crate::{catalog::Selection, form_preferences::GenerationFormPreferences};
use serde::{Deserialize, Serialize};
use std::{path::Path, process::Command, sync::Mutex, time::Duration};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Backend {
    Cpu,
    Gpu,
    Unknown,
}

#[derive(Debug, Serialize)]
pub struct Policy {
    pub backend: Backend,
    pub recommended_steps: u32,
    pub defaults: GenerationFormPreferences,
}

pub fn policy(backend: Backend, selection: &Selection) -> Policy {
    let steps = crate::catalog::catalog()
        .models
        .iter()
        .find(|m| {
            m.provider == selection.provider
                && m.file == selection.synthesis
                && m.role == "synthesis"
        })
        .and_then(|m| m.recommended_steps)
        .unwrap_or(80);
    let recommended_steps = recommended_steps(backend, steps);
    Policy {
        backend,
        recommended_steps,
        defaults: GenerationFormPreferences {
            inference_steps: recommended_steps,
            ..Default::default()
        },
    }
}

pub fn recommended_steps(backend: Backend, steps: u32) -> u32 {
    if backend == Backend::Gpu {
        steps
    } else {
        steps.min(30)
    }
}

#[derive(Default)]
pub struct Probe(Mutex<Option<Backend>>);

impl Probe {
    pub fn cached(&self) -> Backend {
        if crate::hardware::cpu_only() {
            Backend::Cpu
        } else {
            self.0
                .try_lock()
                .ok()
                .and_then(|value| *value)
                .unwrap_or(Backend::Unknown)
        }
    }

    pub fn inspect(&self, resources: &Path, refresh: bool) -> Backend {
        if crate::hardware::cpu_only() {
            return Backend::Cpu;
        }
        let mut cached = self.0.lock().unwrap();
        if !refresh {
            if let Some(backend) = *cached {
                return backend;
            }
        }
        let backend = self.run(resources).unwrap_or(Backend::Unknown);
        *cached = Some(backend);
        backend
    }

    fn run(&self, resources: &Path) -> Option<Backend> {
        let executable = std::env::current_exe().ok()?;
        #[cfg(target_os = "macos")]
        let executable = {
            let helper = executable.with_file_name("music-engine-supervisor");
            if helper.is_file() {
                helper
            } else {
                executable
            }
        };
        let engine = resources.join("engine");
        let output = crate::process_output::output(
            Command::new(executable)
                .arg("--synthesis-backend-probe")
                .arg(&engine)
                .current_dir(&engine),
            Duration::from_secs(5),
        )?;
        output
            .lines()
            .rev()
            .find_map(|line| serde_json::from_str(line).ok())
    }
}

/// Run before Tauri/single-instance initialization, also in the sandboxed supervisor.
pub fn cli() -> Option<i32> {
    let mut args = std::env::args_os().skip(1);
    if args.next().as_deref() != Some(std::ffi::OsStr::new("--synthesis-backend-probe")) {
        return None;
    }
    let result = args.next().and_then(|folder| {
        let cpu = args.next().as_deref() == Some(std::ffi::OsStr::new("--cpu"));
        // SAFETY: only the pinned engine's GGML C ABI is loaded, in this disposable child.
        unsafe { detect(Path::new(&folder), cpu).ok() }
    });
    match result {
        Some(backend) => {
            println!("{}", serde_json::to_string(&backend).unwrap());
            Some(0)
        }
        None => Some(1),
    }
}

unsafe fn detect(
    folder: &Path,
    force_cpu: bool,
) -> std::result::Result<Backend, Box<dyn std::error::Error>> {
    use std::ffi::{c_char, c_void, CStr, CString};
    type Handle = *mut c_void;
    // Exact exported signatures are shared by both GGML revisions in models/manifest.json.
    let library = libloading::Library::new(folder.join(if cfg!(windows) {
        "ggml.dll"
    } else if cfg!(target_os = "macos") {
        "libggml.dylib"
    } else {
        "libggml.so"
    }))?;
    // Windows GetProcAddress does not search dependency DLLs. Backend handles live
    // in ggml-base, while the registry/device-selection functions live in ggml.
    let base = libloading::Library::new(folder.join(if cfg!(windows) {
        "ggml-base.dll"
    } else if cfg!(target_os = "macos") {
        "libggml-base.dylib"
    } else {
        "libggml-base.so"
    }))?;
    let load =
        library.get::<unsafe extern "C" fn(*const c_char)>(b"ggml_backend_load_all_from_path\0")?;
    let best = library.get::<unsafe extern "C" fn() -> Handle>(b"ggml_backend_init_best\0")?;
    let named = library.get::<unsafe extern "C" fn(*const c_char, *const c_char) -> Handle>(
        b"ggml_backend_init_by_name\0",
    )?;
    let name = base.get::<unsafe extern "C" fn(Handle) -> *const c_char>(b"ggml_backend_name\0")?;
    let free = base.get::<unsafe extern "C" fn(Handle)>(b"ggml_backend_free\0")?;
    let path = CString::new(folder.to_string_lossy().as_bytes())?;
    load(path.as_ptr());
    // Older Unix engines honor GGML_BACKEND; the pinned Windows engine uses --device.
    let forced = if force_cpu {
        Some("CPU".to_owned())
    } else if cfg!(windows) {
        None
    } else {
        std::env::var("GGML_BACKEND").ok()
    };
    let forced = forced.map(CString::new).transpose()?;
    let backend = match forced {
        Some(device) => named(device.as_ptr(), std::ptr::null()),
        None => best(),
    };
    if backend.is_null() {
        return Err("No synthesis backend initialized".into());
    }
    let label = name(backend);
    let result = if label.is_null() {
        Backend::Unknown
    } else if CStr::from_ptr(label).to_bytes() == b"CPU" {
        Backend::Cpu
    } else {
        Backend::Gpu
    };
    free(backend);
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn model_recommendations_are_capped_only_for_cpu_or_unknown() {
        let mut selection = Selection::from_settings(&Default::default());
        for backend in [Backend::Cpu, Backend::Unknown, Backend::Gpu] {
            assert_eq!(
                policy(backend, &selection).recommended_steps,
                if backend == Backend::Gpu { 80 } else { 30 }
            );
        }
        selection.synthesis = "acestep-v15-turbo-shift3-Q6_K.gguf".into();
        for backend in [Backend::Cpu, Backend::Unknown, Backend::Gpu] {
            assert_eq!(policy(backend, &selection).defaults.inference_steps, 8);
        }
    }
    #[test]
    fn missing_runtime_is_unknown_and_never_assumed_gpu() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(Probe::default().run(dir.path()), None);
    }
}
