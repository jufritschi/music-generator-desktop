use crate::error::{message, Result};
use serde_json::Value;

type Audio = (Vec<u8>, String);
struct Parts {
    audio: Option<Audio>,
    metadata: Option<Vec<u8>>,
}

pub fn extract_json(ctype: &str, body: &[u8]) -> Result<Value> {
    if ctype.starts_with("application/json") {
        return parse_json(body);
    }
    let bytes = multipart_parts(ctype, body, false)?
        .metadata
        .ok_or_else(|| message("No application/json part in engine response"))?;
    parse_json(&bytes)
}

pub fn extract_audio(ctype: &str, body: &[u8]) -> Result<Audio> {
    if ctype.starts_with("audio/") {
        return audio(body.to_vec(), ctype);
    }
    let (bytes, kind) = multipart_parts(ctype, body, true)?
        .audio
        .ok_or_else(|| message("No audio/ part in engine response"))?;
    audio(bytes, &kind)
}

/// Parse a synthesis response once, copying its audio part only once even for long recordings.
pub(super) fn extract_generation(
    ctype: &str,
    body: &[u8],
) -> Result<(Vec<u8>, String, Option<Value>)> {
    if ctype.starts_with("audio/") {
        return extract_audio(ctype, body).map(|(bytes, kind)| (bytes, kind, None));
    }
    let parts = multipart_parts(ctype, body, true)?;
    let metadata = parts.metadata.as_deref().map(parse_json).transpose()?;
    let (bytes, kind) = parts
        .audio
        .ok_or_else(|| message("No audio/ part in engine response"))?;
    let (bytes, extension) = audio(bytes, &kind)?;
    Ok((bytes, extension, metadata))
}

fn parse_json(bytes: &[u8]) -> Result<Value> {
    let value: Value = serde_json::from_slice(bytes)?;
    let value = if let Value::Array(mut items) = value {
        if items.is_empty() {
            return Err(message("Empty engine result"));
        }
        items.remove(0)
    } else {
        value
    };
    if !value.is_object() {
        return Err(message("Invalid engine metadata"));
    }
    Ok(value)
}

fn audio(bytes: Vec<u8>, kind: &str) -> Result<Audio> {
    if bytes.is_empty() {
        return Err(message("Engine returned empty audio"));
    }
    let extension = if kind.contains("mpeg") || kind.contains("mp3") {
        "mp3"
    } else {
        "wav"
    };
    Ok((bytes, extension.into()))
}

fn multipart_parts(ctype: &str, body: &[u8], include_audio: bool) -> Result<Parts> {
    if !ctype.to_lowercase().starts_with("multipart/") {
        return Err(message(format!("Unexpected engine response: {ctype}")));
    }
    let mut bytes = format!("Content-Type: {ctype}\r\nMIME-Version: 1.0\r\n\r\n").into_bytes();
    bytes.extend(body);
    let parsed = mailparse::parse_mail(&bytes).map_err(|error| message(error.to_string()))?;
    let mut result = Parts {
        audio: None,
        metadata: None,
    };
    for part in &parsed.subparts {
        if include_audio && result.audio.is_none() && part.ctype.mimetype.starts_with("audio/") {
            result.audio = Some((
                part.get_body_raw()
                    .map_err(|error| message(error.to_string()))?,
                part.ctype.mimetype.clone(),
            ));
        } else if result.metadata.is_none() && part.ctype.mimetype.starts_with("application/json") {
            result.metadata = Some(
                part.get_body_raw()
                    .map_err(|error| message(error.to_string()))?,
            );
        }
    }
    Ok(result)
}
