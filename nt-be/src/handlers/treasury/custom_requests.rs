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

use crate::services::monitored_accounts::{
    RegisterMonitoredAccountError, register_or_refresh_monitored_account,
};
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
/// Gated on `ChangePolicy`, matching template authoring. The treasury row is ensured through the
/// canonical `register_or_refresh_monitored_account` registrar (not a bare upsert) so it goes
/// through the same SputnikDAO check and `daos` dirty-marking as every other treasury, then the
/// flag is set.
pub async fn set_custom_requests_setting(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Path(dao_id): Path<AccountId>,
    Json(req): Json<CustomRequestsSetting>,
) -> Result<Json<CustomRequestsSetting>, (StatusCode, String)> {
    auth_user
        .verify_can_perform_action(&state, &dao_id, "ChangePolicy")
        .await?;

    // Ensure the monitored_accounts row exists via the canonical path: it enforces the
    // *.sputnik-dao.near gate and marks the daos row dirty for the sync loop. A ChangePolicy holder
    // implies a real DAO (the policy was fetched above), so NotSputnikDao is a defensive 400.
    register_or_refresh_monitored_account(&state.db_pool, &dao_id, false)
        .await
        .map_err(|e| match e {
            RegisterMonitoredAccountError::NotSputnikDao => (
                StatusCode::BAD_REQUEST,
                "Account is not a SputnikDAO treasury".to_string(),
            ),
            RegisterMonitoredAccountError::Db(e) => {
                internal_error("Failed to register treasury", e)
            }
        })?;

    let enabled = sqlx::query_scalar!(
        "UPDATE monitored_accounts SET custom_requests_enabled = $2 WHERE account_id = $1 RETURNING custom_requests_enabled",
        dao_id.as_str(),
        req.enabled
    )
    .fetch_one(&state.db_pool)
    .await
    .map_err(|e| internal_error("Failed to set custom-requests flag", e))?;

    Ok(Json(CustomRequestsSetting { enabled }))
}

#[cfg(test)]
mod tests {
    use crate::{
        AppState,
        auth::{create_jwt, middleware::AUTH_COOKIE_NAME},
        routes::create_routes,
        utils::test_utils::{build_test_state, policy_granting, seed_treasury_policy},
    };
    use axum::{
        body::{Body, to_bytes},
        http::{Request, StatusCode},
    };
    use serde_json::{Value, json};
    use sqlx::PgPool;
    use std::sync::Arc;
    use tower::ServiceExt;
    use uuid::Uuid;

    const DAO_ID: &str = "test-dao.sputnik-dao.near";
    const USER_ACCOUNT_ID: &str = "member.near";

    fn test_state(pool: PgPool) -> Arc<AppState> {
        Arc::new(build_test_state(pool))
    }

    fn uri() -> String {
        format!("/api/treasury/{DAO_ID}/custom-requests")
    }

    /// Seed a DAO with `account_id` as a policy member (enough for the membership-gated GET).
    async fn seed_policy_member(pool: &PgPool, dao_id: &str, account_id: &str) {
        sqlx::query!(
            "INSERT INTO monitored_accounts (account_id) VALUES ($1) ON CONFLICT (account_id) DO NOTHING",
            dao_id,
        )
        .execute(pool)
        .await
        .expect("seed monitored account");
        sqlx::query!(
            "INSERT INTO daos (dao_id) VALUES ($1) ON CONFLICT (dao_id) DO NOTHING",
            dao_id,
        )
        .execute(pool)
        .await
        .expect("seed dao");
        sqlx::query!(
            r#"
            INSERT INTO dao_members (dao_id, account_id, is_policy_member, is_saved, is_hidden)
            VALUES ($1, $2, true, false, false)
            ON CONFLICT (dao_id, account_id) DO UPDATE SET is_policy_member = true
            "#,
            dao_id,
            account_id,
        )
        .execute(pool)
        .await
        .expect("seed policy member");
    }

    /// Member + the on-chain `ChangePolicy` permission — i.e. someone allowed to flip the flag.
    async fn seed_change_policy_member(
        state: &Arc<AppState>,
        pool: &PgPool,
        dao_id: &str,
        account_id: &str,
    ) {
        seed_policy_member(pool, dao_id, account_id).await;
        let dao: near_api::AccountId = dao_id.parse().expect("valid dao id");
        seed_treasury_policy(
            state,
            &dao,
            policy_granting(account_id, &["*:ChangePolicy"]),
        )
        .await;
    }

    async fn issue_auth_cookie(pool: &PgPool, state: &Arc<AppState>, account_id: &str) -> String {
        let user_id: Uuid = sqlx::query_scalar(
            "INSERT INTO users (account_id) VALUES ($1) ON CONFLICT (account_id) DO UPDATE SET updated_at = NOW() RETURNING id",
        )
        .bind(account_id)
        .fetch_one(pool)
        .await
        .expect("create test user");

        let jwt = create_jwt(
            account_id,
            state.env_vars.jwt_secret.as_bytes(),
            state.env_vars.jwt_expiry_hours,
        )
        .expect("create JWT");

        sqlx::query!(
            "INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
            user_id,
            jwt.token_hash,
            jwt.expires_at,
        )
        .execute(pool)
        .await
        .expect("create session");

        format!("{AUTH_COOKIE_NAME}={}", jwt.token)
    }

    async fn send(
        app: axum::Router,
        method: &str,
        cookie: &str,
        body: Option<Value>,
    ) -> (StatusCode, String) {
        let mut builder = Request::builder()
            .method(method)
            .uri(uri())
            .header("cookie", cookie);
        let body = match body {
            Some(v) => {
                builder = builder.header("content-type", "application/json");
                Body::from(v.to_string())
            }
            None => Body::empty(),
        };
        let resp = app.oneshot(builder.body(body).unwrap()).await.unwrap();
        let status = resp.status();
        let text = String::from_utf8(
            to_bytes(resp.into_body(), usize::MAX)
                .await
                .expect("read body")
                .to_vec(),
        )
        .expect("utf-8 body");
        (status, text)
    }

    fn enabled_of(body: &str) -> Option<bool> {
        serde_json::from_str::<Value>(body).unwrap()["enabled"].as_bool()
    }

    #[sqlx::test]
    async fn test_defaults_to_disabled_for_a_member(pool: PgPool) {
        let state = test_state(pool.clone());
        let app = create_routes(state.clone());
        seed_policy_member(&pool, DAO_ID, USER_ACCOUNT_ID).await;
        let cookie = issue_auth_cookie(&pool, &state, USER_ACCOUNT_ID).await;

        let (status, body) = send(app, "GET", &cookie, None).await;
        assert_eq!(status, StatusCode::OK, "a member can read the flag: {body}");
        assert_eq!(
            enabled_of(&body),
            Some(false),
            "the flag defaults to disabled"
        );
    }

    #[sqlx::test]
    async fn test_enable_then_disable_round_trips(pool: PgPool) {
        let state = test_state(pool.clone());
        let app = create_routes(state.clone());
        seed_change_policy_member(&state, &pool, DAO_ID, USER_ACCOUNT_ID).await;
        let cookie = issue_auth_cookie(&pool, &state, USER_ACCOUNT_ID).await;

        // ENABLE -> 200, and a follow-up GET reflects it.
        let (status, body) = send(
            app.clone(),
            "PUT",
            &cookie,
            Some(json!({ "enabled": true })),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "enable should succeed: {body}");
        assert_eq!(enabled_of(&body), Some(true));
        let (_, body) = send(app.clone(), "GET", &cookie, None).await;
        assert_eq!(enabled_of(&body), Some(true), "GET reflects the enable");

        // DISABLE -> 200, and the flag toggles back.
        let (status, body) = send(
            app.clone(),
            "PUT",
            &cookie,
            Some(json!({ "enabled": false })),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "disable should succeed: {body}");
        assert_eq!(enabled_of(&body), Some(false));
        let (_, body) = send(app, "GET", &cookie, None).await;
        assert_eq!(enabled_of(&body), Some(false), "GET reflects the disable");
    }

    #[sqlx::test]
    async fn test_enable_forbidden_without_change_policy(pool: PgPool) {
        let state = test_state(pool.clone());
        let app = create_routes(state.clone());
        // A policy member, but ChangePolicy is granted to someone else — so the write must 403.
        seed_policy_member(&pool, DAO_ID, USER_ACCOUNT_ID).await;
        let dao: near_api::AccountId = DAO_ID.parse().unwrap();
        seed_treasury_policy(
            &state,
            &dao,
            policy_granting("admin.near", &["*:ChangePolicy"]),
        )
        .await;
        let cookie = issue_auth_cookie(&pool, &state, USER_ACCOUNT_ID).await;

        let (status, _) = send(app, "PUT", &cookie, Some(json!({ "enabled": true }))).await;
        assert_eq!(
            status,
            StatusCode::FORBIDDEN,
            "flipping the flag requires ChangePolicy"
        );
    }

    #[sqlx::test]
    async fn test_read_forbidden_for_non_member(pool: PgPool) {
        let state = test_state(pool.clone());
        let app = create_routes(state.clone());
        // A real, onboarded DAO whose only member is someone else (seed both the member row and a
        // policy), so a 403 reflects a genuine non-member rather than an RPC to an unknown DAO.
        seed_policy_member(&pool, DAO_ID, "someone-else.near").await;
        let dao: near_api::AccountId = DAO_ID.parse().unwrap();
        seed_treasury_policy(
            &state,
            &dao,
            policy_granting("someone-else.near", &["*:ChangePolicy"]),
        )
        .await;
        let cookie = issue_auth_cookie(&pool, &state, USER_ACCOUNT_ID).await;

        let (status, _) = send(app, "GET", &cookie, None).await;
        assert_eq!(
            status,
            StatusCode::FORBIDDEN,
            "a non-member cannot read the flag"
        );
    }
}
