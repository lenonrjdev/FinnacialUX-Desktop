use std::future::Future;

/// Runs a non-`Send` async database workflow on a dedicated operating-system
/// thread. The future is created inside that thread, so SQLx borrows never need
/// to satisfy Tauri's cross-thread command future bound.
pub(crate) fn run_local_async_worker<T, F, Fut>(
    thread_name: &'static str,
    task: F,
) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Fut + Send + 'static,
    Fut: Future<Output = Result<T, String>>,
{
    let worker = std::thread::Builder::new()
        .name(thread_name.to_string())
        .spawn(move || tauri::async_runtime::block_on(task()))
        .map_err(|error| format!("Não foi possível iniciar a tarefa nativa '{thread_name}': {error}"))?;

    worker.join().map_err(|panic_payload| {
        let detail = panic_payload
            .downcast_ref::<&str>()
            .map(|value| (*value).to_string())
            .or_else(|| panic_payload.downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "falha interna sem detalhes".to_string());
        format!("A tarefa nativa '{thread_name}' foi interrompida: {detail}")
    })?
}
