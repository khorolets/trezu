//! The per-treasury "Custom Requests" feature flag (custom proposal templates).
//!
//! The feature ships disabled for every treasury. A DAO turns it on from Settings → Developer,
//! which reveals the Request Templates section in the app. Reading the flag only needs DAO
//! membership; flipping it is gated on the same on-chain `ChangePolicy` permission that gates
//! authoring a template, so a privileged member opts the whole treasury in. The flag lives on
//! `monitored_accounts` (the per-treasury record `proposal_templates` already references).

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use near_api::AccountId;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::{AppState, auth::AuthUser};

#[derive(Debug, Serialize, Deserialize)]
pub struct CustomRequestsSetting {
    pub enabled: bool,
}

fn internal_error(context: &str, e: impl std::fmt::Display) -> (StatusCode, String) {
    log::error!("{context}: {e}");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        "Internal server error".to_string(),
    )
}

/// `GET /api/treasury/{dao_id}/custom-requests` — whether the feature is enabled for this treasury.
/// Membership-gated; a treasury with no `monitored_accounts` row yet reads as disabled.
pub async fn get_custom_requests_setting(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Path(dao_id): Path<AccountId>,
) -> Result<Json<CustomRequestsSetting>, (StatusCode, String)> {
    auth_user
        .verify_dao_member_for_http(&state.db_pool, &dao_id)
        .await?;

    let enabled = sqlx::query_scalar!(
        "SELECT custom_requests_enabled FROM monitored_accounts WHERE account_id = $1",
        dao_id.as_str()
    )
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|e| internal_error("Failed to read custom-requests flag", e))?
    .unwrap_or(false);

    Ok(Json(CustomRequestsSetting { enabled }))
}

/// `PUT /api/treasury/{dao_id}/custom-requests` — enable or disable the feature for this treasury.
/// Gated on `ChangePolicy`, matching template authoring. Upserts so a treasury that isn't tracked
/// yet still gets a row.
pub async fn set_custom_requests_setting(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Path(dao_id): Path<AccountId>,
    Json(req): Json<CustomRequestsSetting>,
) -> Result<Json<CustomRequestsSetting>, (StatusCode, String)> {
    auth_user
        .verify_can_perform_action(&state, &dao_id, "ChangePolicy")
        .await?;

    let enabled = sqlx::query_scalar!(
        r#"
        INSERT INTO monitored_accounts (account_id, custom_requests_enabled)
        VALUES ($1, $2)
        ON CONFLICT (account_id) DO UPDATE SET custom_requests_enabled = $2
        RETURNING custom_requests_enabled
        "#,
        dao_id.as_str(),
        req.enabled
    )
    .fetch_one(&state.db_pool)
    .await
    .map_err(|e| internal_error("Failed to set custom-requests flag", e))?;

    Ok(Json(CustomRequestsSetting { enabled }))
}
