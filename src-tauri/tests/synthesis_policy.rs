use music_generator::{
    catalog::Selection,
    engine::backend_status::{BackendLog, BackendSession, Reason},
    synthesis_policy::{session_policy, Backend},
};
use std::io::Write;

#[test]
fn legacy_iteration_defaults_follow_the_resolved_profile_instead_of_the_cpu_recommendation() {
    let mut selection = Selection::from_settings(&Default::default());
    let cpu = music_generator::synthesis_policy::policy(Backend::Cpu, &selection);
    let response = serde_json::to_value(cpu).unwrap();
    assert_eq!(response["recommended_steps"], 30);
    assert_eq!(response["legacy_inference_steps"], 50);
    for synthesis in [
        "acestep-v15-turbo-Q8_0.gguf",
        "acestep-v15-sftturbo50-Q8_0.gguf",
    ] {
        selection.synthesis = synthesis.into();
        let response = serde_json::to_value(music_generator::synthesis_policy::policy(
            Backend::Cpu,
            &selection,
        ))
        .unwrap();
        assert_eq!(response["legacy_inference_steps"], 8);
    }
}

#[test]
fn current_metal_synthesis_overrides_an_unknown_probe_even_with_cpu_language_model() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("engine.log");
    std::fs::write(&path, "").unwrap();
    let session = BackendSession::new(
        BackendLog::capture(&path),
        None,
        Some(Reason::CpuRequested),
        false,
    );
    let mut log = std::fs::OpenOptions::new()
        .append(true)
        .open(&path)
        .unwrap();
    writeln!(log, "[Load] LM backend: CPU (CPU threads: 9)").unwrap();
    writeln!(log, "[Load] DiT backend: MTL0 (CPU threads: 9)").unwrap();

    let policy = session_policy(
        Backend::Unknown,
        &Selection::from_settings(&Default::default()),
        &session.status(),
    );

    assert_eq!(policy.backend, Backend::Gpu);
    assert_eq!(policy.probed_backend, Backend::Unknown);
    assert_eq!(policy.recommended_steps, 80);
}

#[test]
fn current_cpu_synthesis_overrides_gpu_availability_and_stopped_sessions_do_not() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("engine.log");
    std::fs::write(&path, "").unwrap();
    let session = BackendSession::new(BackendLog::capture(&path), None, None, false);
    let mut log = std::fs::OpenOptions::new()
        .append(true)
        .open(&path)
        .unwrap();
    writeln!(log, "[Load] DiT backend: CPU (CPU threads: 9)").unwrap();
    let selection = Selection::from_settings(&Default::default());
    let policy = session_policy(Backend::Gpu, &selection, &session.status());
    assert_eq!(policy.backend, Backend::Cpu);
    assert_eq!(policy.probed_backend, Backend::Gpu);
    assert_eq!(policy.recommended_steps, 30);
    let payload = serde_json::to_value(&policy).unwrap();
    assert_eq!(payload["backend_status"]["synthesis"]["backend"], "cpu");
    assert_eq!(payload["backend_status"]["state"], "running");

    let stopped = music_generator::engine::backend_status::BackendStatus::inactive(true);
    assert_eq!(
        session_policy(Backend::Unknown, &selection, &stopped).backend,
        Backend::Unknown
    );
    assert_eq!(
        session_policy(Backend::Gpu, &selection, &stopped).backend,
        Backend::Gpu
    );
}

#[test]
fn language_model_execution_never_confirms_the_synthesis_device() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("engine.log");
    std::fs::write(&path, "").unwrap();
    let session = BackendSession::new(BackendLog::capture(&path), None, None, false);
    let mut log = std::fs::OpenOptions::new()
        .append(true)
        .open(&path)
        .unwrap();
    writeln!(log, "[Load] LM backend: MTL0 (CPU threads: 9)").unwrap();
    let policy = session_policy(
        Backend::Unknown,
        &Selection::from_settings(&Default::default()),
        &session.status(),
    );
    assert_eq!(policy.backend, Backend::Unknown);
    assert_eq!(policy.recommended_steps, 30);
}

#[test]
fn policy_uses_the_latest_session_after_device_detection() {
    use music_generator::engine::backend_status::{
        Backend as Observed, BackendStatus, EngineState, ObservationState,
    };
    let root = tempfile::tempdir().unwrap();
    let mut active = BackendStatus::inactive(false);
    active.state = EngineState::Running;
    active.synthesis.state = ObservationState::Confirmed;
    active.synthesis.backend = Observed::Metal;
    let reads = std::cell::Cell::new(0);
    let policy = music_generator::synthesis_policy::Probe::default().session_policy(
        root.path(),
        &Selection::from_settings(&Default::default()),
        true,
        || {
            reads.set(reads.get() + 1);
            if reads.get() == 1 {
                active.clone()
            } else {
                BackendStatus::inactive(true)
            }
        },
    );
    let expected = if cfg!(all(target_os = "macos", target_arch = "x86_64")) {
        Backend::Cpu
    } else {
        Backend::Unknown
    };
    assert_eq!(policy.backend, expected);
    assert_eq!(policy.probed_backend, expected);
    assert_eq!(reads.get(), 2);
    assert_eq!(policy.backend_status.state, EngineState::Stopped);
    assert_eq!(policy.backend_status.synthesis.backend, Observed::Unknown);
}
