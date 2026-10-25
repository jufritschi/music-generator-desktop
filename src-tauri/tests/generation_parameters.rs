use axum::{
    extract::Query,
    http::header::CONTENT_TYPE,
    routing::{get, post},
    Json, Router,
};
use music_generator::{
    configuration::{self, SettingsPatch},
    db::Database,
    engine::client::EngineClient,
    state::AppState,
    types::GenerateRequest,
};
use serde_json::{json, Value};
use std::{collections::HashMap, sync::Arc};
use tokio_util::sync::CancellationToken;

fn request() -> GenerateRequest {
    GenerateRequest {
        title: "Lighthouse".into(),
        prompt: "A lighthouse in the rain".into(),
        style: "quiet piano".into(),
        duration: 30.0,
        seed: 42,
        inference_steps: 80,
        lm_temperature: Some(1.2),
        ..Default::default()
    }
}

#[tokio::test]
async fn device_settings_preserve_queued_parameters_and_the_next_request() {
    let root = tempfile::tempdir().unwrap();
    let db = Database::open(root.path()).unwrap();
    let mut settings = db.settings().unwrap();
    settings.setup_complete = true;
    db.save_settings(&settings).unwrap();
    let state = Arc::new(AppState::new(db, root.path().join("resources")));
    state.restore_setup().unwrap();
    let first = state.db.enqueue(&request()).unwrap().remove(0);
    let original = state.db.song(&first).unwrap().params;
    let mut ids = vec![first];

    for device in ["cpu", "auto"] {
        configuration::save(
            state.clone(),
            SettingsPatch {
                lm_device: Some(device.into()),
                ..Default::default()
            },
            |_| Ok(()),
        )
        .await
        .unwrap();
        assert_eq!(state.db.settings().unwrap().lm_device, device);
        for id in &ids {
            assert_eq!(state.db.song(id).unwrap().params, original);
        }
        let id = state.db.enqueue(&request()).unwrap().remove(0);
        assert_eq!(state.db.song(&id).unwrap().params, original);
        ids.push(id);
    }

    for id in ids {
        let (claimed, params) = state.db.claim_next().unwrap().unwrap();
        assert_eq!(claimed, id);
        assert_eq!(params, original);
        assert!(state.db.finish(&id, "fixture.wav", &json!({})).unwrap());
    }
}

#[tokio::test]
async fn lm_receives_requested_caption_and_duration_without_rewriting_saved_parameters() {
    let root = tempfile::tempdir().unwrap();
    let db = Database::open(root.path()).unwrap();
    let id = db.enqueue(&request()).unwrap().remove(0);
    let original = db.song(&id).unwrap().params;
    let (_, params) = db.claim_next().unwrap().unwrap();
    let lm_result = json!({
        "caption": "Different model description",
        "duration": 85,
        "audio_codes": vec!["7"; 425].join(","),
    });
    let app = Router::new()
        .route(
            "/lm",
            post(|Json(request): Json<Value>| async move {
                assert_eq!(request["caption"], "quiet piano, A lighthouse in the rain");
                assert_eq!(request["duration"], 30.0);
                assert_eq!(request["use_cot_caption"], false);
                assert_eq!(request["inference_steps"], 80);
                assert_eq!(request["lm_temperature"], 1.2);
                Json(json!({"id": "lm"}))
            }),
        )
        .route(
            "/synth",
            post(|Json(request): Json<Value>| async move {
                assert_eq!(request["caption"], "Different model description");
                assert_eq!(request["duration"], 85);
                assert_eq!(
                    request["audio_codes"].as_str().unwrap().split(',').count(),
                    150
                );
                Json(json!({"id": "synth"}))
            }),
        )
        .route(
            "/job",
            get(move |Query(query): Query<HashMap<String, String>>| {
                let lm_result = lm_result.clone();
                async move {
                    if !query.contains_key("result") {
                        (
                            [(CONTENT_TYPE, "application/json")],
                            serde_json::to_vec(&json!({"status": "done"})).unwrap(),
                        )
                    } else if query["id"] == "lm" {
                        (
                            [(CONTENT_TYPE, "application/json")],
                            serde_json::to_vec(&lm_result).unwrap(),
                        )
                    } else {
                        ([(CONTENT_TYPE, "audio/wav")], b"RIFFtest".to_vec())
                    }
                }
            }),
        );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let server = tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    let client = EngineClient::new(base.clone(), base, 0.01, 1.0).unwrap();
    let (audio, extension, meta) = client
        .generate(
            &params,
            "lm.gguf",
            "sft.gguf",
            &CancellationToken::new(),
            |_| {},
        )
        .await
        .unwrap();
    server.abort();
    assert_eq!(audio, b"RIFFtest");
    assert_eq!(extension, "wav");
    assert!(db.finish(&id, "fixture.wav", &meta).unwrap());
    let song = db.song(&id).unwrap();
    assert_eq!(params, original);
    assert_eq!(song.params, original);
    assert_eq!(song.params["duration"], 30.0);
    assert_eq!(song.params["prompt"], "A lighthouse in the rain");
    assert_eq!(song.params["style"], "quiet piano");
    assert_eq!(song.result_meta.unwrap()["duration"], 85);
}
