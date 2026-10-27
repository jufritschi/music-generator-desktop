use crate::{
    db,
    error::{message, Result},
    jobs, sandbox,
    state::AppState,
};
use serde::Serialize;
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::Instant,
};
use tauri::{AppHandle, Emitter, Manager, Runtime, State, WebviewWindow};
use tokio::sync::{watch, Mutex as AsyncMutex, OnceCell};

#[derive(Clone, Default, Serialize)]
pub struct Status {
    sequence: u64,
    phase: &'static str,
    error: Option<String>,
}

pub struct Startup {
    root: PathBuf,
    resources: PathBuf,
    started: Instant,
    painted: watch::Sender<bool>,
    painted_ms: AtomicU64,
    initialization: AsyncMutex<()>,
    status: Mutex<Status>,
    launch_allowed: OnceCell<bool>,
}

impl Startup {
    pub fn new(root: PathBuf, resources: PathBuf, started: Instant) -> Self {
        Self {
            root,
            resources,
            started,
            painted_ms: AtomicU64::new(0),
            painted: watch::channel(false).0,
            initialization: AsyncMutex::new(()),
            launch_allowed: OnceCell::new(),
            status: Mutex::new(Status {
                phase: "starting",
                ..Status::default()
            }),
        }
    }

    pub fn snapshot(&self) -> Status {
        self.status.lock().expect("startup status poisoned").clone()
    }

    fn record(&self, phase: &'static str, error: Option<String>) -> Status {
        let mut status = self.status.lock().expect("startup status poisoned");
        if status.phase == "installation_required" {
            return status.clone();
        }
        status.sequence += 1;
        status.phase = phase;
        status.error = error;
        status.clone()
    }

    pub fn report<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        phase: &'static str,
        error: Option<String>,
    ) {
        let status = self.record(phase, error);
        tracing::info!(
            elapsed_ms = self.started.elapsed().as_millis(),
            phase,
            "Startup phase"
        );
        let _ = app.emit_to("splash", "startup-status", status);
    }

    async fn allowed(&self) -> bool {
        let allowed = *self
            .launch_allowed
            .get_or_init(|| async {
                match tauri::async_runtime::spawn_blocking(
                    crate::launch_location::installation_required,
                )
                .await
                {
                    Ok(required) => !required,
                    Err(error) => {
                        eprintln!("Startup location check failed; allowing startup: {error}");
                        true
                    }
                }
            })
            .await;
        if !allowed {
            self.record("installation_required", None);
        }
        allowed
    }

    async fn require_allowed<R: Runtime>(&self, app: &AppHandle<R>) -> Result<()> {
        if self.allowed().await {
            return Ok(());
        }
        self.report(app, "installation_required", None);
        Err(message("Installation required"))
    }

    /// Defer disk access until the splash has painted; serialize retries and reuse successful state.
    pub async fn prepare<R: Runtime>(&self, app: &AppHandle<R>) -> Result<Arc<AppState>> {
        self.require_allowed(app).await?;
        let mut painted = self.painted.subscribe();
        tokio::time::timeout(
            std::time::Duration::from_secs(15),
            painted.wait_for(|ready| *ready),
        )
        .await
        .map_err(|_| message("The startup window did not become ready. Please restart the app."))?
        .map_err(|e| message(e.to_string()))?;
        let _guard = self.initialization.lock().await;
        if let Some(state) = app.try_state::<Arc<AppState>>() {
            return Ok(state.inner().clone());
        }
        self.report(app, "data", None);
        let root = self.root.clone();
        let resources = self.resources.clone();
        let state = tauri::async_runtime::spawn_blocking(move || -> Result<Arc<AppState>> {
            std::fs::create_dir_all(root.join("logs"))?;
            let log = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(root.join("logs/desktop.log"))?;
            let _ = tracing_subscriber::fmt()
                .with_ansi(false)
                .with_writer(Mutex::new(log))
                .try_init();
            let db = db::Database::open(&root)?;
            sandbox::initialize(&root)?;
            crate::audio_export::cleanup_stale(&root);
            Ok(Arc::new(AppState::new(db, resources)))
        })
        .await
        .map_err(|e| message(e.to_string()))??;
        tracing::info!(
            elapsed_ms = self.started.elapsed().as_millis(),
            splash_ms = self.painted_ms.load(Ordering::Relaxed),
            "Startup data initialization finished"
        );
        app.manage(state.clone());
        tauri::async_runtime::spawn(jobs::worker(state.clone(), app.clone()));
        Ok(state)
    }
}

#[tauri::command]
pub fn startup_status(startup: State<'_, Startup>) -> Status {
    startup.snapshot()
}

#[tauri::command]
pub async fn startup_allowed<R: Runtime>(
    startup: State<'_, Startup>,
    app: AppHandle<R>,
) -> Result<bool> {
    Ok(startup.require_allowed(&app).await.is_ok())
}

#[tauri::command]
pub fn splash_ready<R: Runtime>(
    window: WebviewWindow<R>,
    startup: State<'_, Startup>,
) -> Result<()> {
    require_window(&window, "splash")?;
    startup.painted_ms.store(
        startup.started.elapsed().as_millis() as u64,
        Ordering::Relaxed,
    );
    startup.painted.send_replace(true);
    Ok(())
}

#[tauri::command]
pub fn startup_error<R: Runtime>(
    window: WebviewWindow<R>,
    startup: State<'_, Startup>,
    app: AppHandle<R>,
    error: String,
) -> Result<()> {
    require_window(&window, "main")?;
    startup.report(&app, "error", Some(error));
    Ok(())
}

#[tauri::command]
pub async fn retry_startup<R: Runtime>(
    window: WebviewWindow<R>,
    startup: State<'_, Startup>,
    app: AppHandle<R>,
) -> Result<()> {
    require_window(&window, "splash")?;
    startup.require_allowed(&app).await?;
    if startup
        .status
        .lock()
        .expect("startup status poisoned")
        .error
        .is_none()
    {
        return Err(message("Startup is still running"));
    }
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| message("Main window is unavailable"))?;
    startup.report(&app, "starting", None);
    if let Err(error) = main.reload() {
        startup.report(&app, "error", Some(error.to_string()));
        return Err(message(error.to_string()));
    }
    Ok(())
}

#[tauri::command]
pub async fn startup_complete<R: Runtime>(
    window: WebviewWindow<R>,
    startup: State<'_, Startup>,
    app: AppHandle<R>,
) -> Result<()> {
    require_window(&window, "main")?;
    startup.require_allowed(&app).await?;
    window.show().map_err(|e| message(e.to_string()))?;
    let _ = window.set_focus();
    startup.report(&app, "ready", None);
    if let Some(splash) = app.get_webview_window("splash") {
        splash.destroy().map_err(|e| message(e.to_string()))?;
    }
    Ok(())
}

fn require_window<R: Runtime>(window: &WebviewWindow<R>, label: &str) -> Result<()> {
    if window.label() == label {
        Ok(())
    } else {
        Err(message("Unavailable in this window"))
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use tauri::{
        test::{mock_app, MockRuntime},
        WebviewWindowBuilder,
    };

    fn fixture(allowed: bool) -> (tempfile::TempDir, tauri::App<MockRuntime>) {
        let temporary = tempfile::tempdir().unwrap();
        let app = mock_app();
        let startup = Startup::new(
            temporary.path().join("data"),
            temporary.path().into(),
            Instant::now(),
        );
        startup.launch_allowed.set(allowed).unwrap();
        app.manage(startup);
        for label in ["main", "splash"] {
            WebviewWindowBuilder::new(&app, label, Default::default())
                .visible(label == "splash")
                .build()
                .unwrap();
        }
        (temporary, app)
    }

    #[tokio::test]
    async fn blocked_prepare_returns_before_opening_data_or_creating_application_state() {
        let (temporary, app) = fixture(false);
        let splash = app.get_webview_window("splash").unwrap();
        splash_ready(splash, app.state()).unwrap();
        let result = app.state::<Startup>().prepare(app.handle()).await;
        assert_eq!(result.err().unwrap().to_string(), "Installation required");
        assert!(!temporary.path().join("data").exists());
        assert!(app.try_state::<Arc<AppState>>().is_none());
        assert_eq!(startup_status(app.state()).phase, "installation_required");
    }

    #[tokio::test]
    async fn blocked_retry_cannot_reload_main_or_clear_the_installation_requirement() {
        let (_temporary, app) = fixture(false);
        let main = app.get_webview_window("main").unwrap();
        let splash = app.get_webview_window("splash").unwrap();
        startup_error(
            main.clone(),
            app.state(),
            app.handle().clone(),
            "early failure".into(),
        )
        .unwrap();
        let error = retry_startup(splash, app.state(), app.handle().clone())
            .await
            .unwrap_err();
        assert_eq!(error.to_string(), "Installation required");
        startup_error(
            main,
            app.state(),
            app.handle().clone(),
            "late failure".into(),
        )
        .unwrap();
        let status = startup_status(app.state());
        assert_eq!(status.phase, "installation_required");
        assert!(status.error.is_none());
    }

    #[tokio::test]
    async fn blocked_completion_cannot_reveal_main_or_destroy_the_splash() {
        let (temporary, app) = fixture(false);
        let main = app.get_webview_window("main").unwrap();
        let error = startup_complete(main, app.state(), app.handle().clone())
            .await
            .unwrap_err();
        assert_eq!(error.to_string(), "Installation required");
        assert!(app.get_webview_window("splash").is_some());
        assert!(!temporary.path().join("data").exists());
        assert_eq!(startup_status(app.state()).phase, "installation_required");
    }

    #[tokio::test]
    async fn installed_start_can_complete_normally() {
        let (_temporary, app) = fixture(true);
        assert!(startup_allowed(app.state(), app.handle().clone())
            .await
            .unwrap());
        let main = app.get_webview_window("main").unwrap();
        startup_complete(main, app.state(), app.handle().clone())
            .await
            .unwrap();
        assert_eq!(startup_status(app.state()).phase, "ready");
    }

    #[tokio::test]
    async fn startup_cleans_stale_exports_before_publishing_state_and_never_sweeps_active_state() {
        let (temporary, app) = fixture(true);
        let exports = temporary.path().join("data/export");
        let stale = exports.join("temporary-0123456789ab4def8123456789abcdef");
        std::fs::create_dir_all(&stale).unwrap();
        std::fs::write(stale.join("source.wav"), b"unfinished source").unwrap();
        std::fs::write(stale.join("encoded.mp3"), b"unfinished conversion").unwrap();

        let cache = exports.join(format!("{}-4096-123456789-192.mp3", "a".repeat(64)));
        let finished = exports.join("finished.zip");
        let temporary_file = exports.join("temporary-22222222222242228222222222222222");
        for path in [&cache, &finished, &temporary_file] {
            std::fs::write(path, b"keep completed file").unwrap();
        }
        let unrelated = [
            "temporary-user-files",
            "temporary-0123456789ab1def8123456789abcdef",
            "temporary-ABCDEF0123454DEF8123456789ABCDEF",
            "temporary-01234567-89ab-4def-8123-456789abcdef",
        ]
        .map(|name| exports.join(name));
        for path in &unrelated {
            std::fs::create_dir(path).unwrap();
            std::fs::write(path.join("keep.txt"), b"unrelated directory").unwrap();
        }
        let outside = temporary.path().join("external-export");
        std::fs::create_dir(&outside).unwrap();
        std::fs::write(outside.join("keep.wav"), b"external source").unwrap();
        let link = exports.join("temporary-fedcba98765443218abcdef012345678");
        std::os::unix::fs::symlink(&outside, &link).unwrap();

        assert!(app.try_state::<Arc<AppState>>().is_none());
        splash_ready(app.get_webview_window("splash").unwrap(), app.state()).unwrap();
        let state = app.state::<Startup>().prepare(app.handle()).await.unwrap();

        assert!(app.try_state::<Arc<AppState>>().is_some());
        assert!(!stale.exists());
        for path in [&cache, &finished, &temporary_file] {
            assert_eq!(std::fs::read(path).unwrap(), b"keep completed file");
        }
        for path in &unrelated {
            assert_eq!(
                std::fs::read(path.join("keep.txt")).unwrap(),
                b"unrelated directory"
            );
        }
        assert!(std::fs::symlink_metadata(&link)
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(
            std::fs::read(outside.join("keep.wav")).unwrap(),
            b"external source"
        );

        let active = exports.join("temporary-1234567890ab4def8123456789abcdef");
        std::fs::create_dir(&active).unwrap();
        std::fs::write(active.join("source.wav"), b"active conversion").unwrap();
        let reused = app.state::<Startup>().prepare(app.handle()).await.unwrap();

        assert!(Arc::ptr_eq(&state, &reused));
        assert_eq!(
            std::fs::read(active.join("source.wav")).unwrap(),
            b"active conversion"
        );
        state.begin_shutdown();
    }

    #[tokio::test]
    async fn startup_preserves_temporary_files_beyond_a_symlinked_export_directory() {
        let (temporary, app) = fixture(true);
        let data = temporary.path().join("data");
        std::fs::create_dir(&data).unwrap();
        let outside = temporary.path().join("external-exports");
        let external_work = outside.join("temporary-0123456789ab4def8123456789abcdef");
        std::fs::create_dir_all(&external_work).unwrap();
        std::fs::write(external_work.join("source.wav"), b"external conversion").unwrap();
        let exports = data.join("export");
        std::os::unix::fs::symlink(&outside, &exports).unwrap();
        splash_ready(app.get_webview_window("splash").unwrap(), app.state()).unwrap();

        let state = app.state::<Startup>().prepare(app.handle()).await.unwrap();

        assert!(app.try_state::<Arc<AppState>>().is_some());
        assert!(std::fs::symlink_metadata(exports)
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(std::fs::read_dir(&outside).unwrap().count(), 1);
        assert_eq!(std::fs::read_dir(&external_work).unwrap().count(), 1);
        assert_eq!(
            std::fs::read(external_work.join("source.wav")).unwrap(),
            b"external conversion"
        );
        state.begin_shutdown();
    }
}
