use music_generator::engine::backend_status::{BackendLog, BackendSession, BackendStatus, Reason};
use serde_json::json;
use std::io::Write;

#[test]
fn windows_cuda_compatibility_is_bound_to_the_delivered_archive() {
    use music_generator::hardware::{CudaCompatibility, NvidiaGpu};
    let engine = music_generator::manifest::manifest().engines["windows"].clone();
    let gpu = NvidiaGpu {
        compute_capability: Some("6.1".into()),
        driver_version: Some("580.0".into()),
    };
    let compatibility = CudaCompatibility::for_engine(&engine, Some(&gpu)).unwrap();
    assert_eq!(compatibility.minimum_compute_capability, "7.5");
    assert_eq!(compatibility.architecture_supported, Some(false));
    let mut changed = engine.clone();
    changed["sha256"] = json!("different archive");
    assert!(CudaCompatibility::for_engine(&changed, Some(&gpu)).is_none());
    assert_eq!(
        CudaCompatibility::for_engine(&engine, None)
            .unwrap()
            .architecture_supported,
        None
    );
}

#[tokio::test]
async fn health_reports_not_started_without_launching_or_reading_old_engine_logs() {
    let root = tempfile::tempdir().unwrap();
    let db = music_generator::db::Database::open(root.path()).unwrap();
    std::fs::create_dir_all(root.path().join("logs")).unwrap();
    std::fs::write(
        root.path().join("logs/ace-server.log"),
        "[Load] DiT backend: CUDA0 (shared)\n",
    )
    .unwrap();
    let state = music_generator::state::AppState::new(db, root.path().into());
    let health = state.health().await;
    assert_eq!(health["backend_status"]["state"], "not_started");
    assert_eq!(health["backend_status"]["synthesis"]["backend"], "unknown");
}

#[test]
fn status_confirms_only_current_model_execution_and_keeps_lm_separate() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("ace-server.log");
    std::fs::write(&path, "[Load] DiT backend: CUDA0 (shared)\n").unwrap();
    let session = BackendSession::new(BackendLog::capture(&path), None, None, false);
    let mut log = std::fs::OpenOptions::new()
        .append(true)
        .open(&path)
        .unwrap();
    writeln!(log, "load_backend: loaded Vulkan backend\nServer listening").unwrap();
    let status = serde_json::to_value(session.status()).unwrap();
    assert_eq!(status["synthesis"]["backend"], "unknown");
    assert_eq!(status["language_model"]["state"], "unconfirmed");
    writeln!(log, "[Load] LM backend: Vulkan0 (CPU threads: 6)").unwrap();
    let status = serde_json::to_value(session.status()).unwrap();
    assert_eq!(status["language_model"]["backend"], "vulkan");
    assert_eq!(status["language_model"]["device"], "Vulkan0");
    assert_eq!(status["synthesis"]["state"], "unconfirmed");
    writeln!(log, "[Load] DiT backend: Vulkan0 (shared)").unwrap();
    let status = serde_json::to_value(session.status()).unwrap();
    assert_eq!(
        status["synthesis"],
        json!({"state":"confirmed","backend":"vulkan","device":"Vulkan0","reason":null})
    );
}

#[test]
fn cpu_language_model_explains_user_choice_and_selftest_fallback_without_changing_synthesis() {
    for (reason, expected) in [
        (Reason::CpuRequested, "cpu_requested"),
        (Reason::LmSelftestFailed, "lm_selftest_failed"),
    ] {
        let root = tempfile::tempdir().unwrap();
        let synth = root.path().join("ace-server.log");
        let lm = root.path().join("ace-lm.log");
        let session = BackendSession::new(
            BackendLog::capture(&synth),
            Some(BackendLog::capture(&lm)),
            Some(reason),
            true,
        );
        std::fs::write(&synth, "[Load] DiT backend: Vulkan0 (CPU threads: 4)\n").unwrap();
        std::fs::write(&lm, "[Load] LM backend: CPU (CPU threads: 4)\n").unwrap();
        let status = serde_json::to_value(session.status()).unwrap();
        assert_eq!(status["synthesis"]["backend"], "vulkan");
        assert_eq!(
            status["synthesis"]["reason"],
            "cuda_architecture_unsupported"
        );
        assert_eq!(status["language_model"]["backend"], "cpu");
        assert_eq!(status["language_model"]["reason"], expected);
    }
}

#[test]
fn cuda_metal_and_cpu_are_confirmed_from_execution_and_unknown_causes_stay_unknown() {
    for (device, backend, reason) in [
        ("CUDA0", "cuda", None),
        ("Metal", "metal", None),
        ("MTL0", "metal", None),
        ("CPU", "cpu", Some(Reason::CpuOnly)),
        ("Vulkan0", "vulkan", None),
    ] {
        let root = tempfile::tempdir().unwrap();
        let log = root.path().join("engine.log");
        let session = BackendSession::new(BackendLog::capture(&log), None, reason, false);
        std::fs::write(
            &log,
            format!(
                "[Load] LM backend: {device} (shared)\n[Load] DiT backend: {device} (shared)\n"
            ),
        )
        .unwrap();
        let status = serde_json::to_value(session.status()).unwrap();
        assert_eq!(status["synthesis"]["backend"], backend);
        assert_eq!(status["language_model"]["backend"], backend);
        assert_eq!(
            status["language_model"]["reason"],
            serde_json::to_value(reason).unwrap()
        );
    }
}

#[test]
fn current_cuda_initialization_failure_explains_vulkan_but_a_new_start_discards_it() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("engine.log");
    let session = BackendSession::new(BackendLog::capture(&path), None, None, false);
    std::fs::write(&path, "ggml_cuda_init: failed to initialize CUDA: no CUDA-capable device\n[Load] LM backend: Vulkan0 (shared)\n").unwrap();
    let status = serde_json::to_value(session.status()).unwrap();
    assert_eq!(
        status["language_model"]["reason"],
        "cuda_initialization_failed"
    );
    let restart = BackendSession::new(BackendLog::capture(&path), None, None, false);
    let status = serde_json::to_value(restart.status()).unwrap();
    assert_eq!(status["language_model"]["state"], "unconfirmed");
    let mut file = std::fs::OpenOptions::new()
        .append(true)
        .open(&path)
        .unwrap();
    write!(file, "[Load] LM backend: CU").unwrap();
    assert_eq!(
        serde_json::to_value(restart.status()).unwrap()["language_model"]["backend"],
        "unknown"
    );
    writeln!(file, "DA0 (shared)").unwrap();
    let status = serde_json::to_value(restart.status()).unwrap();
    assert_eq!(status["language_model"]["backend"], "cuda");
    assert!(status["language_model"]["reason"].is_null());
    let stopped = serde_json::to_value(BackendStatus::inactive(true)).unwrap();
    assert_eq!(stopped["state"], "stopped");
    assert_eq!(stopped["language_model"]["backend"], "unknown");
}

#[test]
fn cuda_plugin_load_failures_are_explained_without_attributing_unrelated_backend_errors() {
    for (message, expected) in [
        ("load_backend: failed to load C:\\engine\\ggml-cuda.dll: The specified module could not be found", json!("cuda_initialization_failed")),
        ("load_backend: failed to initialize backend from /engine/libggml-cuda.so", json!("cuda_initialization_failed")),
        ("load_backend: failed to load C:\\engine\\ggml-cpu-alderlake.dll: The specified module could not be found", json!(null)),
    ] {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("engine.log");
        let session = BackendSession::new(BackendLog::capture(&path), None, None, false);
        std::fs::write(&path, format!("{message}\n[Load] LM backend: Vulkan0 (shared)\n")).unwrap();
        let status = serde_json::to_value(session.status()).unwrap();
        assert_eq!(status["language_model"]["reason"], expected, "{message}");
        let next_attempt = BackendSession::new(BackendLog::capture(&path), None, None, false);
        let mut file = std::fs::OpenOptions::new().append(true).open(&path).unwrap();
        writeln!(file, "[Load] LM backend: Vulkan0 (shared)").unwrap();
        assert!(serde_json::to_value(next_attempt.status()).unwrap()["language_model"]["reason"].is_null());
    }
}
