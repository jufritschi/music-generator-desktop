#![cfg(target_os = "macos")]

use std::{
    path::Path,
    process::Command,
    time::{Duration, Instant},
};

fn runtime(root: &Path) {
    // Native ABI fixture: registration represents expensive cold shader compilation.
    let source = root.join("runtime.c");
    std::fs::write(
        &source,
        r#"
        #include <unistd.h>
        #include <stdlib.h>
        void ggml_backend_load_all_from_path(const char *path) { sleep(10); }
        void *ggml_backend_init_best(void) { return (void *)1; }
        void *ggml_backend_init_by_name(const char *name, const char *params) { return (void *)1; }
        const char *ggml_backend_name(void *backend) { return "CPU"; }
        void ggml_backend_free(void *backend) {}
        void *ggml_backend_load(const char *path) { return (void *)1; }
        void *ggml_backend_metal_reg(void) { abort(); }
    "#,
    )
    .unwrap();
    let library = root.join("libggml.dylib");
    let result = Command::new("cc")
        .arg("-dynamiclib")
        .arg(&source)
        .arg("-o")
        .arg(&library)
        .output()
        .unwrap();
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    for name in ["libggml-base.dylib", "libggml-metal.so", "libggml-cpu.so"] {
        std::fs::copy(&library, root.join(name)).unwrap();
    }
}

#[test]
fn automatic_macos_probe_does_not_wait_for_cold_shader_compilation() {
    let root = tempfile::tempdir().unwrap();
    runtime(root.path());
    let mut child = Command::new(env!("CARGO_BIN_EXE_music-generator"))
        .args(["--synthesis-backend-probe", root.path().to_str().unwrap()])
        .env_remove("GGML_BACKEND")
        .env_remove("GGML_METAL_DEVICES")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .unwrap();
    let started = Instant::now();
    while child.try_wait().unwrap().is_none() {
        if started.elapsed() > Duration::from_secs(3) {
            child.kill().unwrap();
            child.wait().unwrap();
            panic!("Model-free device detection waited for shader compilation");
        }
        std::thread::sleep(Duration::from_millis(10));
    }
    let output = child.wait_with_output().unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let backend: String = serde_json::from_slice(&output.stdout).unwrap();
    if cfg!(target_arch = "x86_64") {
        assert_eq!(backend, "cpu");
    } else {
        assert!(["gpu", "unknown"].contains(&backend.as_str()));
    }
}

#[test]
fn explicit_cpu_and_disabled_metal_do_not_use_the_available_gpu() {
    let root = tempfile::tempdir().unwrap();
    runtime(root.path());
    for flag in [true, false] {
        let mut command = Command::new(env!("CARGO_BIN_EXE_music-generator"));
        command.args(["--synthesis-backend-probe", root.path().to_str().unwrap()]);
        if flag {
            command.arg("--cpu").env_remove("GGML_BACKEND");
        } else {
            command.env("GGML_BACKEND", "CPU");
        }
        let output = command.output().unwrap();
        assert!(output.status.success());
        assert_eq!(String::from_utf8(output.stdout).unwrap().trim(), "\"cpu\"");
    }
    let output = Command::new(env!("CARGO_BIN_EXE_music-generator"))
        .args(["--synthesis-backend-probe", root.path().to_str().unwrap()])
        .env_remove("GGML_BACKEND")
        .env("GGML_METAL_DEVICES", "0")
        .output()
        .unwrap();
    assert!(output.status.success());
    let expected = if cfg!(target_arch = "x86_64") {
        "\"cpu\""
    } else {
        "\"unknown\""
    };
    assert_eq!(String::from_utf8(output.stdout).unwrap().trim(), expected);
}

#[test]
fn missing_metal_runtime_does_not_claim_gpu_availability() {
    if cfg!(target_arch = "x86_64") {
        return;
    }
    let root = tempfile::tempdir().unwrap();
    runtime(root.path());
    std::fs::remove_file(root.path().join("libggml-metal.so")).unwrap();
    let output = Command::new(env!("CARGO_BIN_EXE_music-generator"))
        .args(["--synthesis-backend-probe", root.path().to_str().unwrap()])
        .env_remove("GGML_BACKEND")
        .env_remove("GGML_METAL_DEVICES")
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(1));
    assert!(output.stdout.is_empty());
}

#[test]
fn detailed_probe_reports_the_actual_backend_kind_without_changing_legacy_output() {
    let root = tempfile::tempdir().unwrap();
    runtime(root.path());
    let output = Command::new(env!("CARGO_BIN_EXE_music-generator"))
        .args([
            "--synthesis-backend-probe",
            root.path().to_str().unwrap(),
            "--cpu",
            "--details",
        ])
        .env_remove("GGML_BACKEND")
        .output()
        .unwrap();
    assert!(output.status.success());
    let details: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(details["backend"], "cpu");
    assert_eq!(details["kind"], "cpu");
    let output = Command::new(env!("CARGO_BIN_EXE_music-generator"))
        .args([
            "--synthesis-backend-probe",
            root.path().to_str().unwrap(),
            "--details",
        ])
        .env_remove("GGML_BACKEND")
        .env_remove("GGML_METAL_DEVICES")
        .output()
        .unwrap();
    assert!(output.status.success());
    let details: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    match details["backend"].as_str().unwrap() {
        "gpu" => assert_eq!(details["kind"], "metal"),
        "cpu" => assert_eq!(details["kind"], "cpu"),
        "unknown" => assert_eq!(details["kind"], "unknown"),
        unexpected => panic!("Unexpected readiness: {unexpected}"),
    }
}
