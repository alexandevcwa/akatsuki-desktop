use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AkatsukiError {
    #[error("Error de E/S en el sistema de archivos: {0}")]
    Io(#[from] std::io::Error),

    #[error("Error de red HTTPS hacia el servicio Android: {0}")]
    Network(#[from] reqwest::Error),

    #[error("Fallo de seguridad TLS / Certificate Pinning (TOFU): {0}")]
    TlsPinningError(String),

    #[error("Discrepancia de integridad SHA-256: esperado {expected}, calculado {actual}")]
    IntegrityMismatch { expected: String, actual: String },

    #[error("Operación inválida: {0}")]
    InvalidOperation(String),
}

impl Serialize for AkatsukiError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S::Error: serde::ser::Error,
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AkatsukiResult<T> = Result<T, AkatsukiError>;
