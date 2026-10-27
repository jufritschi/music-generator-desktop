use super::{BackendKind, Detection};
use objc2::{rc::Retained, runtime::AnyObject};
use std::{ffi::c_void, path::Path};

#[link(name = "Metal", kind = "framework")]
extern "C" {
    fn MTLCreateSystemDefaultDevice() -> *mut AnyObject;
}

/// Confirm native Metal availability and the bundled adapter without compiling GGML shaders.
pub(super) unsafe fn detect(
    folder: &Path,
) -> std::result::Result<Detection, Box<dyn std::error::Error>> {
    if std::env::var("GGML_METAL_DEVICES")
        .ok()
        .is_some_and(|value| value.parse::<u32>().map_or(true, |count| count == 0))
    {
        return Ok(Detection::new(BackendKind::Unknown));
    }
    let metal = libloading::Library::new(folder.join("libggml-metal.so"))?;
    // Resolve the pinned adapter ABI, but do not call registration: it compiles every shader.
    metal.get::<unsafe extern "C" fn() -> *mut c_void>(b"ggml_backend_metal_reg\0")?;
    let Some(device) = Retained::from_raw(MTLCreateSystemDefaultDevice()) else {
        return Ok(Detection::new(BackendKind::Unknown));
    };
    let queue: *mut AnyObject = objc2::msg_send![&*device, newCommandQueue];
    Ok(Detection::new(if Retained::from_raw(queue).is_some() {
        BackendKind::Metal
    } else {
        BackendKind::Unknown
    }))
}
