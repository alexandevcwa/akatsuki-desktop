use crate::error::{AkatsukiError, AkatsukiResult};

/// Normaliza y valida una huella SHA-256 de certificado TLS bajo el modelo TOFU (Trust On First Use).
pub fn verify_tls_certificate_pin(
    observed_fingerprint: &str,
    expected_fingerprint: Option<&str>,
) -> AkatsukiResult<String> {
    let normalized_observed = observed_fingerprint.trim().to_uppercase();

    if let Some(expected) = expected_fingerprint {
        let normalized_expected = expected.trim().to_uppercase();
        if !normalized_expected.is_empty() && normalized_observed != normalized_expected {
            return Err(AkatsukiError::TlsPinningError(format!(
                "La huella del certificado TLS del Android ({}) no coincide con el pin esperado ({})",
                normalized_observed, normalized_expected
            )));
        }
    }

    Ok(normalized_observed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_verify_tls_pin_matches() {
        let fp = "9F:86:D0:81:88:4C:7D:65";
        let res = verify_tls_certificate_pin(fp, Some("9f:86:d0:81:88:4c:7d:65"));
        assert!(res.is_ok());
    }

    #[test]
    fn test_verify_tls_pin_rejects_mismatch() {
        let res = verify_tls_certificate_pin("AA:BB:CC", Some("11:22:33"));
        assert!(res.is_err());
    }
}
