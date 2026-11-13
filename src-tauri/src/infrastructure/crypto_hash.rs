use crate::error::AkatsukiResult;
use sha2::{Digest, Sha256};
use std::path::Path;
use tokio::fs::File;
use tokio::io::AsyncReadExt;

/// Calcula la huella criptográfica SHA-256 de un archivo leyendo en bloques asíncronos (64 KB)
/// sin saturar la memoria RAM en archivos pesados.
pub async fn compute_file_sha256(path: &Path) -> AkatsukiResult<String> {
    let mut file = File::open(path).await?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 64 * 1024];

    loop {
        let bytes_read = file.read(&mut buffer).await?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    let digest = hasher.finalize();
    Ok(hex::encode(digest))
}

/// Calcula el hash SHA-256 de un bloque de bytes en memoria (ej. Certificado TLS DER).
pub fn compute_bytes_sha256_colon_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let digest = hasher.finalize();
    digest
        .iter()
        .map(|b| format!("{:02X}", b))
        .collect::<Vec<_>>()
        .join(":")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_bytes_sha256_colon_hex() {
        let fingerprint = compute_bytes_sha256_colon_hex(b"akatsuki-sharingan-cert");
        assert_eq!(fingerprint.split(':').count(), 32);
    }
}
