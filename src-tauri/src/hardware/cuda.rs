use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Clone, Serialize)]
pub struct NvidiaGpu {
    pub compute_capability: Option<String>,
    pub driver_version: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CudaCompatibility {
    pub minimum_compute_capability: String,
    pub architecture_supported: Option<bool>,
}

impl CudaCompatibility {
    /// Architecture metadata applies only to the exact archive that was inspected.
    pub fn for_engine(engine: &Value, gpu: Option<&NvidiaGpu>) -> Option<Self> {
        let cuda = engine.get("cuda")?;
        if cuda["engine_revision"].as_str()? != engine["revision"].as_str()?
            || cuda["archive_sha256"].as_str()? != engine["sha256"].as_str()?
        {
            return None;
        }
        let minimum = cuda["minimum_compute_capability"].as_str()?;
        let required = capability(minimum)?;
        let architecture_supported = gpu
            .and_then(|gpu| gpu.compute_capability.as_deref())
            .and_then(capability)
            .map(|actual| actual >= required);
        Some(Self {
            minimum_compute_capability: minimum.into(),
            architecture_supported,
        })
    }
}

fn capability(value: &str) -> Option<(u16, u16)> {
    let (major, minor) = value.split_once('.')?;
    Some((major.parse().ok()?, minor.parse().ok()?))
}

/// Optional NVIDIA columns must never discard a valid adapter name or VRAM reading.
pub(super) fn adapter(text: &str) -> Option<(String, Option<u64>, Option<NvidiaGpu>)> {
    let lines: Vec<_> = text
        .lines()
        .filter(|line| !line.trim().is_empty())
        .collect();
    let first = lines.first()?;
    let columns: Vec<_> = first.split(',').map(str::trim).collect();
    if columns.len() < 2 || columns[0].is_empty() {
        return None;
    }
    let vram = columns[1].parse::<u64>().ok().map(|m| m * 1024 * 1024);
    // Device-to-adapter attribution is ambiguous on machines with multiple NVIDIA GPUs.
    let nvidia = (lines.len() == 1).then(|| NvidiaGpu {
        compute_capability: columns
            .get(2)
            .filter(|s| capability(s).is_some())
            .map(|s| (*s).into()),
        driver_version: columns
            .get(3)
            .filter(|s| s.chars().any(|c| c.is_ascii_digit()) && !s.contains("N/A"))
            .map(|s| (*s).into()),
    });
    let names = lines
        .iter()
        .filter_map(|line| line.split(',').next())
        .map(str::trim)
        .collect::<Vec<_>>()
        .join(", ");
    Some((names, vram, nvidia))
}
