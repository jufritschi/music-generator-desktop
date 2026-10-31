use super::{
    client::{limit_audio_codes, EngineClient},
    diagnostics::SynthesisLog,
    progress::Progress,
    response::extract_generation,
};
use crate::error::{message, Error, Result};
use serde_json::{json, Value};
use std::time::{Duration, Instant};
use tokio_util::sync::CancellationToken;

impl EngineClient {
    pub async fn generate(
        &self,
        params: &Value,
        lm_file: &str,
        dit: &str,
        cancel: &CancellationToken,
        progress: impl Fn(Progress),
    ) -> Result<(Vec<u8>, String, Value)> {
        const FIELDS: &[&str] = &[
            "caption",
            "lyrics",
            "bpm",
            "duration",
            "keyscale",
            "timesignature",
            "vocal_language",
            "seed",
            "lm_temperature",
            "lm_cfg_scale",
            "inference_steps",
            "guidance_scale",
            "use_cot_caption",
        ];
        // Normalize to the actual peak instead of clipping percentile outliers.
        let mut request = json!({"output_format":"wav16", "peak_clip":0, "lm_model": lm_file, "synth_model": dit});
        for field in FIELDS {
            if let Some(value) = params
                .get(field)
                .filter(|v| !v.is_null() && v.as_str() != Some(""))
            {
                request[field] = value.clone();
            }
        }

        let steps =
            crate::generation_limits::effective_steps(params["inference_steps"].as_u64(), dit);
        request["inference_steps"] = json!(steps);
        let mut enriched = self
            .complete_codes(&request, params, cancel, &progress)
            .await?;
        // The synthesis model supports at most 600 seconds (3000 codes).
        // Trim occasional LM overproduction only in this outgoing payload;
        // saved song parameters remain unchanged.
        limit_audio_codes(&mut enriched, params);
        if let Some(claimed) = enriched.get("duration").cloned() {
            enriched["lm_duration"] = claimed;
        }
        if let Some(requested) = crate::audio_facts::requested_duration(params) {
            enriched["duration"] = json!(requested);
        }
        // LM metadata cannot silently change the synthesis iteration contract.
        enriched["inference_steps"] = json!(steps);
        enriched
            .as_object_mut()
            .unwrap()
            .remove("effective_inference_steps");
        enriched
            .as_object_mut()
            .unwrap()
            .remove("inference_steps_limit");
        if let Some(seed) = request.get("seed") {
            enriched["seed"] = seed.clone();
        }
        enriched["output_format"] = json!("wav16");
        enriched["peak_clip"] = json!(0);
        enriched["synth_model"] = json!(dit);
        let log = self.synth_log.as_deref().map(SynthesisLog::capture);
        let result = self
            .operation(
                &self.synth,
                "synth",
                self.http
                    .post(format!("{}/synth", self.synth))
                    .json(&enriched),
                cancel,
                progress,
            )
            .await
            .and_then(|(ctype, body)| extract_generation(&ctype, &body));
        let (audio, extension, metadata) = result.map_err(|error| {
            if matches!(error, Error::Cancelled | Error::EngineTimeout { .. }) {
                return error;
            }
            log.as_ref()
                .and_then(|log| log.hint(&error.to_string()))
                .map(message)
                .unwrap_or(error)
        })?;
        record_iteration_evidence(steps, metadata.as_ref(), &mut enriched)?;
        let seconds = crate::audio_facts::duration(&audio)?;
        crate::audio_facts::record_duration(seconds, params, &mut enriched);
        Ok((audio, extension, enriched))
    }
}

/// Only the synthesis response can establish the updated runtime's actual execution contract.
fn record_iteration_evidence(
    requested: u32,
    metadata: Option<&Value>,
    result: &mut Value,
) -> Result<()> {
    use crate::generation_limits::{LEGACY_INFERENCE_STEPS_LIMIT, MAX_INFERENCE_STEPS};
    let supported = metadata.and_then(|meta| meta["inference_steps_limit"].as_u64())
        == Some(u64::from(MAX_INFERENCE_STEPS));
    let limit = if supported {
        MAX_INFERENCE_STEPS
    } else {
        LEGACY_INFERENCE_STEPS_LIMIT
    };
    let actual = metadata
        .and_then(|meta| meta["effective_inference_steps"].as_u64())
        .filter(|steps| (1..=u64::from(limit)).contains(steps));
    if supported && actual.is_none() {
        return Err(message(
            "Engine did not confirm its effective iteration count",
        ));
    }
    let actual = actual.unwrap_or_else(|| u64::from(requested.min(limit)));
    result["inference_steps"] = json!(actual);
    result["effective_inference_steps"] = json!(actual);
    if supported {
        result["inference_steps_limit"] = json!(limit);
    }
    Ok(())
}

impl EngineClient {
    /// Retry the LM stage at most once; synthesize the best available codes exactly once.
    async fn complete_codes(
        &self,
        request: &Value,
        params: &Value,
        cancel: &CancellationToken,
        progress: &impl Fn(Progress),
    ) -> Result<Value> {
        let started = Instant::now();
        let mut best = self.language_model(request, cancel, progress).await?;
        let mut count = code_count(&best);
        let mut attempts = 1;
        let remaining = self.timeout.saturating_sub(started.elapsed());
        let short = count == 0
            || crate::audio_facts::requested_duration(params).is_some_and(|requested| {
                (count as f64 / 5.0) + crate::audio_facts::tolerance(requested) + 1e-6 < requested
            });
        if short && !remaining.is_zero() {
            let mut retry = request.clone();
            let previous = best["lm_seed"].as_u64().map(|seed| seed as u32);
            let seed = previous
                .map(|seed| seed.wrapping_add(1))
                .unwrap_or_else(|| uuid::Uuid::new_v4().as_u128() as u32);
            retry["lm_seed"] = json!(seed);
            let mut client = self.clone();
            client.timeout = remaining.min(Duration::from_secs(120));
            attempts = 2;
            match client.language_model(&retry, cancel, progress).await {
                Ok(candidate) => {
                    let candidate_count = code_count(&candidate);
                    if candidate_count > count {
                        best = candidate;
                        count = candidate_count;
                    }
                }
                Err(Error::Cancelled) => return Err(Error::Cancelled),
                Err(error) => {
                    best["lm_retry_error"] =
                        json!(error.to_string().chars().take(500).collect::<String>());
                }
            }
            best["lm_retry_seed"] = json!(seed);
        }
        if cancel.is_cancelled() {
            return Err(Error::Cancelled);
        }
        if count == 0 {
            return Err(message(
                "Language model returned no audio codes. Run the hardware test again.",
            ));
        }
        best["lm_attempts"] = json!(attempts);
        Ok(best)
    }
}

fn code_count(meta: &Value) -> usize {
    meta["audio_codes"]
        .as_str()
        .unwrap_or("")
        .split(',')
        .filter(|code| !code.trim().is_empty())
        .count()
}

impl EngineClient {
    /// Cover mode: the source song is sent with the request to /synth. No language model runs.
    pub async fn generate_cover(
        &self,
        params: &Value,
        source: Vec<u8>,
        dit: &str,
        cancel: &CancellationToken,
        progress: impl Fn(Progress),
    ) -> Result<(Vec<u8>, String, Value)> {
        let request = json!({
            "task_type": "cover-nofsq",
            "caption": params["caption"],
            "lyrics": params["lyrics"],
            "audio_cover_strength": params["cover_strength"],
        });
        self.generate_from_source(params, request, source, dit, cancel, progress)
            .await
    }

    /// Repaint mode: only the time range from repaint_start to repaint_end is regenerated.
    /// The rest of the source song is kept as it is. No language model runs.
    pub async fn generate_repaint(
        &self,
        params: &Value,
        source: Vec<u8>,
        dit: &str,
        cancel: &CancellationToken,
        progress: impl Fn(Progress),
    ) -> Result<(Vec<u8>, String, Value)> {
        let request = json!({
            "task_type": "repaint",
            "caption": params["caption"],
            "lyrics": params["lyrics"],
            "repainting_start": params["repaint_start"],
            "repainting_end": params["repaint_end"],
        });
        self.generate_from_source(params, request, source, dit, cancel, progress)
            .await
    }

    /// Shared path for every request that sends a source song to /synth.
    async fn generate_from_source(
        &self,
        params: &Value,
        mut request: Value,
        source: Vec<u8>,
        dit: &str,
        cancel: &CancellationToken,
        progress: impl Fn(Progress),
    ) -> Result<(Vec<u8>, String, Value)> {
        let steps =
            crate::generation_limits::effective_steps(params["inference_steps"].as_u64(), dit);
        request["inference_steps"] = json!(steps);
        request["synth_model"] = json!(dit);
        request["output_format"] = json!("wav16");
        request["peak_clip"] = json!(0);
        for field in ["bpm", "keyscale", "timesignature", "vocal_language", "seed"] {
            if let Some(value) = params
                .get(field)
                .filter(|v| !v.is_null() && v.as_str() != Some(""))
            {
                request[field] = value.clone();
            }
        }
        let name = params["source_audio"]
            .as_str()
            .filter(|n| !n.is_empty())
            .unwrap_or("source.wav")
            .to_string();
        let form = reqwest::multipart::Form::new()
            .part(
                "audio",
                reqwest::multipart::Part::bytes(source).file_name(name),
            )
            .text("request", request.to_string());
        let (ctype, body) = self
            .operation(
                &self.synth,
                "synth",
                self.http
                    .post(format!("{}/synth", self.synth))
                    .multipart(form),
                cancel,
                progress,
            )
            .await?;
        let (audio, extension, metadata) = extract_generation(&ctype, &body)?;
        let mut enriched = request;
        record_iteration_evidence(steps, metadata.as_ref(), &mut enriched)?;
        let seconds = crate::audio_facts::duration(&audio)?;
        crate::audio_facts::record_duration(seconds, params, &mut enriched);
        Ok((audio, extension, enriched))
    }
}
