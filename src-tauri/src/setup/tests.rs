use super::*;

#[tokio::test]
async fn invalid_folder_input_preserves_saved_configuration_without_starting_setup() {
    let root = tempfile::tempdir().unwrap();
    let db = crate::db::Database::open(root.path()).unwrap();
    let mut settings = db.settings().unwrap();
    settings.expert_mode = true;
    settings.setup_complete = true;
    db.save_settings(&settings).unwrap();
    let state = Arc::new(AppState::new(db, root.path().join("no-engine")));
    state.restore_setup().unwrap();
    let before = serde_json::to_value(state.db.settings().unwrap()).unwrap();
    let file = root.path().join("file");
    std::fs::write(&file, b"keep").unwrap();
    for (models, songs, error) in [
        (
            "relative".to_owned(),
            settings.songs_dir.clone(),
            "path_absolute",
        ),
        (
            settings.models_dir.clone(),
            "~/songs".to_owned(),
            "path_absolute",
        ),
        (
            settings.models_dir.clone(),
            file.to_string_lossy().into_owned(),
            "path_not_directory",
        ),
    ] {
        let request = SetupRequest {
            lm: "0.6B".into(),
            xl: false,
            models_dir: models,
            songs_dir: songs,
        };
        let result = configure(
            state.clone(),
            request,
            |_| panic!("must not download"),
            |_| panic!("must not start engine"),
            |_| panic!("must not commit"),
        )
        .await;
        assert_eq!(result.unwrap_err().to_string(), error);
        assert_eq!(
            serde_json::to_value(state.db.settings().unwrap()).unwrap(),
            before
        );
        assert!(state.runtime.is_ready());
        assert!(!Path::new(&settings.models_dir).exists());
    }
}
