use serde::{Deserialize, Serialize};
use std::sync::Mutex;

mod log;
pub use log::BackendLog;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Backend {
    Cuda,
    Vulkan,
    Metal,
    Cpu,
    #[default]
    Unknown,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Reason {
    CpuRequested,
    CpuOnly,
    LmSelftestFailed,
    CudaArchitectureUnsupported,
    CudaInitializationFailed,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum EngineState {
    NotStarted,
    Running,
    Stopped,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ObservationState {
    NotStarted,
    Unconfirmed,
    Confirmed,
    Stopped,
}

#[derive(Clone, Debug, Serialize)]
pub struct ComponentStatus {
    pub state: ObservationState,
    pub backend: Backend,
    pub device: Option<String>,
    pub reason: Option<Reason>,
}

impl ComponentStatus {
    fn empty(state: ObservationState) -> Self {
        Self {
            state,
            backend: Backend::Unknown,
            device: None,
            reason: None,
        }
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct BackendStatus {
    pub state: EngineState,
    pub synthesis: ComponentStatus,
    pub language_model: ComponentStatus,
}

impl BackendStatus {
    /// A stopped or absent process never presents historical observations as active.
    pub fn inactive(stopped: bool) -> Self {
        let state = if stopped {
            ObservationState::Stopped
        } else {
            ObservationState::NotStarted
        };
        Self {
            state: if stopped {
                EngineState::Stopped
            } else {
                EngineState::NotStarted
            },
            synthesis: ComponentStatus::empty(state),
            language_model: ComponentStatus::empty(state),
        }
    }
}

/// Observes the current owned processes without starting an engine or performing inference.
pub struct BackendSession {
    synthesis: Mutex<BackendLog>,
    language: Option<Mutex<BackendLog>>,
    cpu_reason: Option<Reason>,
    cuda_unsupported: bool,
}

impl BackendSession {
    pub fn new(
        synthesis: BackendLog,
        language: Option<BackendLog>,
        cpu_reason: Option<Reason>,
        cuda_unsupported: bool,
    ) -> Self {
        Self {
            synthesis: Mutex::new(synthesis),
            language: language.map(Mutex::new),
            cpu_reason,
            cuda_unsupported,
        }
    }

    pub fn status(&self) -> BackendStatus {
        let mut synthesis = self.synthesis.lock().unwrap();
        synthesis.refresh();
        let mut language = self.language.as_ref().map(|log| log.lock().unwrap());
        if let Some(log) = language.as_mut() {
            log.refresh();
        }
        let language_log = language.as_deref().unwrap_or(&synthesis);
        let synth_reason = (self.cpu_reason == Some(Reason::CpuOnly)).then_some(Reason::CpuOnly);
        BackendStatus {
            state: EngineState::Running,
            synthesis: self.component(&synthesis, false, synth_reason),
            language_model: self.component(language_log, true, self.cpu_reason),
        }
    }

    fn component(
        &self,
        log: &BackendLog,
        language: bool,
        cpu_reason: Option<Reason>,
    ) -> ComponentStatus {
        let Some((backend, device)) = (if language {
            &log.language
        } else {
            &log.synthesis
        }) else {
            return ComponentStatus::empty(ObservationState::Unconfirmed);
        };
        let reason = if *backend == Backend::Cpu && cpu_reason.is_some() {
            cpu_reason
        } else if *backend != Backend::Cuda && self.cuda_unsupported {
            Some(Reason::CudaArchitectureUnsupported)
        } else if *backend != Backend::Cuda && log.cuda_failed {
            Some(Reason::CudaInitializationFailed)
        } else {
            None
        };
        ComponentStatus {
            state: ObservationState::Confirmed,
            backend: *backend,
            device: Some(device.clone()),
            reason,
        }
    }
}
