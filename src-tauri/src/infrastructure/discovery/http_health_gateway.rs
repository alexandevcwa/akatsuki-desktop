use crate::domain::device::HealthResponse;
use crate::domain::discovery::{BoxFuture, NodeHealthGateway};
use crate::error::AkatsukiResult;
use crate::infrastructure::android_client::check_android_health;

/// Adaptador HTTP/TLS que valida el estado de un nodo Android mediante `GET /api/v1/health`.
#[derive(Debug, Default)]
pub struct ReqwestHealthGateway;

impl NodeHealthGateway for ReqwestHealthGateway {
    fn check_health<'a>(
        &'a self,
        ip: &'a str,
        port: u16,
    ) -> BoxFuture<'a, AkatsukiResult<HealthResponse>> {
        Box::pin(check_android_health(ip, port))
    }
}
