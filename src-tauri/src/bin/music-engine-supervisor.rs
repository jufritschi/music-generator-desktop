fn main() {
    if let Some(code) = music_generator::synthesis_policy::cli() {
        std::process::exit(code);
    }
    std::process::exit(music_generator::engine::process::supervise().unwrap_or(2));
}
