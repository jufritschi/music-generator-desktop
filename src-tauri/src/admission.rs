//! New-work admission is separate from execution so accepted jobs survive preference changes.
use crate::{
    catalog::{self, Selection},
    error::{message, Result},
    state::AppState,
    types::{GenerateRequest, Settings},
    verification::ModelVerifier,
};
use std::path::Path;

pub fn generate(state: &AppState, mut request: GenerateRequest) -> Result<Vec<String>> {
    state.runtime.enqueue(|| {
        let settings = state.db.settings()?;
        let selection = request
            .model_selection
            .clone()
            .unwrap_or_else(|| Selection::from_settings(&settings));
        catalog::ensure_allowed(&selection, settings.expert_mode)?;
        if !catalog::cached(
            &selection,
            Path::new(&settings.models_dir),
            &ModelVerifier::open(&state.db.root),
        )? {
            return Err(message(
                "Open the ModelPicker and download or verify the selected models first",
            ));
        }
        request.model_selection = Some(selection);
        state.db.enqueue(&request)
    })
}

pub fn retry(state: &AppState, id: &str) -> Result<()> {
    state.runtime.enqueue(|| {
        let settings = state.db.settings()?;
        let song = state.db.song(id)?;
        let selection = song
            .params
            .get("model_selection")
            .filter(|value| !value.is_null())
            .map(|value| serde_json::from_value(value.clone()))
            .transpose()?
            .unwrap_or_else(|| Selection::from_settings(&settings));
        catalog::ensure_allowed(&selection, settings.expert_mode)?;
        state.db.retry(id)
    })
}

/// Validate before starting or modifying the analysis engine.
pub fn analysis_settings(state: &AppState, selection: Option<Selection>) -> Result<Settings> {
    let mut settings = state.db.settings()?;
    if let Some(selection) = selection {
        selection.apply(&mut settings)?;
    }
    catalog::ensure_allowed(&Selection::from_settings(&settings), settings.expert_mode)?;
    Ok(settings)
}
