/// The verified desktop runtime supports up to two hundred diffusion iterations.
pub const MAX_INFERENCE_STEPS: u32 = 200;
pub(crate) const LEGACY_INFERENCE_STEPS_LIMIT: u32 = 100;

/// Resolve legacy engine defaults before applying the same limit to every execution path.
pub fn effective_steps(requested: Option<u64>, synthesis: &str) -> u32 {
    match requested.filter(|steps| *steps > 0) {
        Some(steps) => steps.min(u64::from(MAX_INFERENCE_STEPS)) as u32,
        None if synthesis.contains("turbo") => 8,
        None => 50,
    }
}

/// Interpret historical synthesis inputs without editing the original request or claiming missing evidence.
pub fn enrich_metadata(params: &serde_json::Value, meta: &mut serde_json::Value) {
    let limit = if meta["inference_steps_limit"].as_u64() == Some(u64::from(MAX_INFERENCE_STEPS)) {
        MAX_INFERENCE_STEPS
    } else {
        LEGACY_INFERENCE_STEPS_LIMIT
    };
    if let Some(verified) = meta["effective_inference_steps"]
        .as_u64()
        .filter(|steps| (1..=u64::from(MAX_INFERENCE_STEPS)).contains(steps))
    {
        meta["effective_inference_steps"] = verified.min(u64::from(limit)).into();
        return;
    }
    let Some(requested) = meta["inference_steps"].as_u64() else {
        return;
    };
    let synthesis = meta["synth_model"]
        .as_str()
        .or_else(|| params["model_selection"]["synthesis"].as_str());
    if requested == 0 && synthesis.is_none() {
        return;
    }
    let steps = effective_steps(Some(requested), synthesis.unwrap_or_default()).min(limit);
    meta["effective_inference_steps"] = steps.into();
}
