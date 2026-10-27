use music_generator::{db::Database, types::GenerateRequest};
use serde_json::json;

fn wav(seconds: f64) -> Vec<u8> {
    let size = (seconds * 1_000.0) as u32 * 2;
    let mut bytes = Vec::new();
    bytes.extend(b"RIFF");
    bytes.extend((size + 36).to_le_bytes());
    bytes.extend(b"WAVEfmt ");
    bytes.extend(16u32.to_le_bytes());
    bytes.extend(1u16.to_le_bytes());
    bytes.extend(1u16.to_le_bytes());
    bytes.extend(1_000u32.to_le_bytes());
    bytes.extend(2_000u32.to_le_bytes());
    bytes.extend(2u16.to_le_bytes());
    bytes.extend(16u16.to_le_bytes());
    bytes.extend(b"data");
    bytes.extend(size.to_le_bytes());
    bytes.resize(44 + size as usize, 0);
    bytes
}

#[test]
fn historical_results_show_measured_audio_and_effective_steps_without_rewriting_history() {
    let root = tempfile::tempdir().unwrap();
    let db = Database::open(root.path()).unwrap();
    let id = db
        .enqueue(&GenerateRequest {
            prompt: "legacy piano".into(),
            duration: 10.0,
            inference_steps: 80,
            ..Default::default()
        })
        .unwrap()
        .remove(0);
    let (_, mut original) = db.claim_next().unwrap().unwrap();
    original["inference_steps"] = json!(120);
    let raw = rusqlite::Connection::open(root.path().join("music.db")).unwrap();
    raw.execute(
        "UPDATE songs SET params=?1 WHERE id=?2",
        rusqlite::params![original.to_string(), id],
    )
    .unwrap();
    let songs = std::path::PathBuf::from(db.settings().unwrap().songs_dir);
    std::fs::create_dir_all(&songs).unwrap();
    std::fs::write(songs.join("legacy.wav"), wav(5.6)).unwrap();
    let metadata = json!({"duration": 10.0, "inference_steps": 120, "synth_model": "acestep-v15-sft-Q8_0.gguf"});
    db.finish(&id, "legacy.wav", &metadata).unwrap();

    let song = db.song(&id).unwrap();
    assert_eq!(song.params, original);
    let projected = song.result_meta.unwrap();
    assert_eq!(projected["duration"], 5.6);
    assert_eq!(projected["requested_duration"], 10.0);
    assert_eq!(projected["duration_warning"]["code"], "short_audio");
    assert_eq!(projected["effective_inference_steps"], 100);
    let (saved_params, saved_meta): (String, String) = raw
        .query_row(
            "SELECT params,result_meta FROM songs WHERE id=?1",
            [&id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&saved_params).unwrap(),
        original
    );
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&saved_meta).unwrap(),
        metadata
    );
}

#[test]
fn missing_or_damaged_historical_audio_does_not_present_the_request_as_measured_duration() {
    for (name, contents, unavailable) in [
        ("missing.wav", None, false),
        ("damaged.wav", Some(b"RIFFtest".as_slice()), false),
        ("unavailable.wav", None, true),
    ] {
        let root = tempfile::tempdir().unwrap();
        let db = Database::open(root.path()).unwrap();
        let id = db
            .enqueue(&GenerateRequest {
                prompt: "legacy".into(),
                duration: 10.0,
                ..Default::default()
            })
            .unwrap()
            .remove(0);
        let (_, original) = db.claim_next().unwrap().unwrap();
        let songs = std::path::PathBuf::from(db.settings().unwrap().songs_dir);
        std::fs::create_dir_all(&songs).unwrap();
        if let Some(contents) = contents {
            std::fs::write(songs.join(name), contents).unwrap();
        }
        let metadata = json!({"duration": 10.0});
        db.finish(&id, name, &metadata).unwrap();
        if unavailable {
            rusqlite::Connection::open(root.path().join("music.db"))
                .unwrap()
                .execute("UPDATE songs SET audio_missing=1 WHERE id=?1", [&id])
                .unwrap();
        }
        let song = db.song(&id).unwrap();
        assert_eq!(song.params, original);
        let projected = song.result_meta.unwrap();
        assert!(projected.get("duration").is_none());
        assert_eq!(projected["duration_source"], "unknown");
        assert_eq!(projected["requested_duration"], 10.0);
        assert_eq!(projected["lm_duration"], 10.0);
    }
}
