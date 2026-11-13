use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AkatsukiError {
    #[error("No se pudo acceder al archivo o carpeta solicitada en el equipo.")]
    Io(#[from] std::io::Error),

    #[error("{0}")]
    NetworkFriendly(String),

    #[error("{0}")]
    HttpStatusFriendly(String),

    #[error("La verificación de seguridad del dispositivo falló: {0}")]
    TlsPinningError(String),

    #[error("El archivo transferido no superó la verificación de integridad. Intenta enviarlo nuevamente.")]
    IntegrityMismatch { expected: String, actual: String },

    #[error("{0}")]
    InvalidOperation(String),
}

impl From<reqwest::Error> for AkatsukiError {
    fn from(err: reqwest::Error) -> Self {
        if err.is_timeout() {
            return AkatsukiError::NetworkFriendly(
                "El dispositivo Android tardó demasiado en responder. Verifica que la pantalla esté activa y en la misma red Wi-Fi.".to_string(),
            );
        }
        if err.is_connect() {
            return AkatsukiError::NetworkFriendly(
                "No se encontró el dispositivo Android en la dirección indicada. Verifica la IP, el puerto y que el servicio esté iniciado en tu celular.".to_string(),
            );
        }
        AkatsukiError::NetworkFriendly(
            "No fue posible comunicarse con el dispositivo Android. Revisa tu conexión de red local.".to_string(),
        )
    }
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
