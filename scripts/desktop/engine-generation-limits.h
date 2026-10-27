#pragma once

// Shared by actual DiT execution, output provenance and the model-free package contract.
constexpr int DESKTOP_MAX_INFERENCE_STEPS = 200;

inline int desktop_inference_steps(int requested, bool turbo) {
    if (requested <= 0) {
        return turbo ? 8 : 50;
    }
    return requested > DESKTOP_MAX_INFERENCE_STEPS ? DESKTOP_MAX_INFERENCE_STEPS : requested;
}
