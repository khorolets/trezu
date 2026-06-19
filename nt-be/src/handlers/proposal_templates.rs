//! Per-DAO custom proposal templates (the manifest-driven custom-proposal framework).
//!
//! A `manifest` is a JSON form definition. A techy DAO member authors a template; regular
//! members later fill the rendered form to file a generic SputnikDAO `FunctionCall` proposal.
//! This module is the storage + CRUD layer (mirrors `address_book`). The form engine and
//! renderer live in the frontend; the on-chain proposal a template produces still passes the
//! DAO's normal permissions and approvals, so a manifest never grants authority by itself.

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use chrono::{DateTime, Utc};
use near_api::AccountId;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

use crate::{AppState, auth::AuthUser};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposalTemplate {
    pub id: Uuid,
    pub dao_id: AccountId,
    pub name: String,
    pub description: Option<String>,
    pub manifest: Value,
    pub enabled: bool,
    pub created_by: Option<AccountId>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Row shape for the join queries (list / fetch-by-id), with the creator's wallet resolved.
struct ProposalTemplateRow {
    id: Uuid,
    dao_id: String,
    name: String,
    description: Option<String>,
    manifest: Value,
    enabled: bool,
    created_by_wallet: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl TryFrom<ProposalTemplateRow> for ProposalTemplate {
    type Error = near_account_id::ParseAccountError;

    fn try_from(r: ProposalTemplateRow) -> Result<Self, Self::Error> {
        Ok(ProposalTemplate {
            id: r.id,
            dao_id: r.dao_id.parse()?,
            name: r.name,
            description: r.description,
            manifest: r.manifest,
            enabled: r.enabled,
            created_by: r.created_by_wallet.map(|s| s.parse()).transpose()?,
            created_at: r.created_at,
            updated_at: r.updated_at,
        })
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProposalTemplateRequest {
    pub name: String,
    pub description: Option<String>,
    pub manifest: Value,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProposalTemplateRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub manifest: Option<Value>,
    pub enabled: Option<bool>,
}

fn default_enabled() -> bool {
    true
}

/// Minimal server-side manifest validation at the API boundary (DESIGN §3.4).
///
/// PR1 enforces the structural shape so obvious garbage never reaches the database. Strict
/// field-type / u128 / args-mapping validation is a deliberate follow-up — it must mirror the
/// frontend zod validator, so it lands with the form engine.
fn validate_manifest(manifest: &Value) -> Result<(), String> {
    let obj = manifest
        .as_object()
        .ok_or("manifest must be a JSON object")?;

    let non_empty_str = |key: &str| {
        obj.get(key)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|s| !s.is_empty())
    };

    if non_empty_str("id").is_none() {
        return Err("manifest.id must be a non-empty string".to_string());
    }
    if non_empty_str("title").is_none() {
        return Err("manifest.title must be a non-empty string".to_string());
    }

    let binding = obj
        .get("binding")
        .and_then(Value::as_object)
        .ok_or("manifest.binding must be an object")?;
    let binding_str = |key: &str| {
        binding
            .get(key)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|s| !s.is_empty())
    };
    if binding_str("receiver_id").is_none() {
        return Err("manifest.binding.receiver_id must be a non-empty string".to_string());
    }
    if binding_str("method_name").is_none() {
        return Err("manifest.binding.method_name must be a non-empty string".to_string());
    }

    if !obj.get("fields").map(Value::is_array).unwrap_or(false) {
        return Err("manifest.fields must be an array".to_string());
    }

    Ok(())
}

fn internal_error(context: &str, e: impl std::fmt::Display) -> (StatusCode, String) {
    log::error!("{context}: {e}");
    (StatusCode::INTERNAL_SERVER_ERROR, context.to_string())
}

fn forbidden() -> (StatusCode, String) {
    (
        StatusCode::FORBIDDEN,
        "Not a DAO policy member".to_string(),
    )
}

/// Re-fetch a full template (with creator wallet) after a mutation, scoped to the DAO.
async fn fetch_template_by_id(
    pool: &PgPool,
    dao_id: &str,
    id: Uuid,
) -> Result<Option<ProposalTemplateRow>, sqlx::Error> {
    sqlx::query_as!(
        ProposalTemplateRow,
        r#"
        SELECT pt.id, pt.dao_id, pt.name, pt.description,
               pt.manifest AS "manifest: serde_json::Value",
               pt.enabled, pt.created_at, pt.updated_at,
               u.account_id AS created_by_wallet
        FROM proposal_templates pt
        LEFT JOIN users u ON u.id = pt.created_by
        WHERE pt.dao_id = $1 AND pt.id = $2
        "#,
        dao_id,
        id
    )
    .fetch_optional(pool)
    .await
}

pub async fn list_proposal_templates(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Path(dao_id): Path<AccountId>,
) -> Result<Json<Vec<ProposalTemplate>>, (StatusCode, String)> {
    auth_user
        .verify_dao_member(&state.db_pool, &dao_id)
        .await
        .map_err(|_| forbidden())?;

    let templates: Vec<ProposalTemplate> = sqlx::query_as!(
        ProposalTemplateRow,
        r#"
        SELECT pt.id, pt.dao_id, pt.name, pt.description,
               pt.manifest AS "manifest: serde_json::Value",
               pt.enabled, pt.created_at, pt.updated_at,
               u.account_id AS created_by_wallet
        FROM proposal_templates pt
        LEFT JOIN users u ON u.id = pt.created_by
        WHERE pt.dao_id = $1
        ORDER BY pt.created_at DESC
        "#,
        dao_id.as_str()
    )
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| internal_error("Failed to list proposal templates", e))?
    .into_iter()
    .map(ProposalTemplate::try_from)
    .collect::<Result<_, _>>()
    .map_err(|e| internal_error("Invalid account in proposal template", e))?;

    Ok(Json(templates))
}

pub async fn create_proposal_template(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Path(dao_id): Path<AccountId>,
    Json(req): Json<CreateProposalTemplateRequest>,
) -> Result<(StatusCode, Json<ProposalTemplate>), (StatusCode, String)> {
    auth_user
        .verify_dao_member(&state.db_pool, &dao_id)
        .await
        .map_err(|_| forbidden())?;

    validate_manifest(&req.manifest).map_err(|e| (StatusCode::BAD_REQUEST, e))?;

    let user_id = sqlx::query_scalar!(
        "SELECT id FROM users WHERE account_id = $1",
        auth_user.account_id.as_str()
    )
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|e| internal_error("Failed to look up user", e))?;

    let id: Uuid = sqlx::query_scalar!(
        r#"
        INSERT INTO proposal_templates (dao_id, name, description, manifest, enabled, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        "#,
        dao_id.as_str(),
        req.name,
        req.description,
        req.manifest,
        req.enabled,
        user_id
    )
    .fetch_one(&state.db_pool)
    .await
    .map_err(|e| {
        if e.as_database_error()
            .map(|db| db.is_unique_violation())
            .unwrap_or(false)
        {
            (
                StatusCode::CONFLICT,
                "A template with this name already exists for this DAO".to_string(),
            )
        } else {
            internal_error("Failed to create proposal template", e)
        }
    })?;

    let row = fetch_template_by_id(&state.db_pool, dao_id.as_str(), id)
        .await
        .map_err(|e| internal_error("Failed to load created template", e))?
        .ok_or_else(|| internal_error("Created template vanished", "not found"))?;

    let template =
        ProposalTemplate::try_from(row).map_err(|e| internal_error("Invalid account in template", e))?;

    Ok((StatusCode::CREATED, Json(template)))
}

pub async fn update_proposal_template(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Path((dao_id, id)): Path<(AccountId, Uuid)>,
    Json(req): Json<UpdateProposalTemplateRequest>,
) -> Result<Json<ProposalTemplate>, (StatusCode, String)> {
    auth_user
        .verify_dao_member(&state.db_pool, &dao_id)
        .await
        .map_err(|_| forbidden())?;

    if let Some(manifest) = &req.manifest {
        validate_manifest(manifest).map_err(|e| (StatusCode::BAD_REQUEST, e))?;
    }

    // COALESCE keeps existing values for any field omitted from the request.
    let updated = sqlx::query_scalar!(
        r#"
        UPDATE proposal_templates
        SET name        = COALESCE($3, name),
            description = COALESCE($4, description),
            manifest    = COALESCE($5, manifest),
            enabled     = COALESCE($6, enabled)
        WHERE dao_id = $1 AND id = $2
        RETURNING id
        "#,
        dao_id.as_str(),
        id,
        req.name,
        req.description,
        req.manifest,
        req.enabled,
    )
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|e| {
        if e.as_database_error()
            .map(|db| db.is_unique_violation())
            .unwrap_or(false)
        {
            (
                StatusCode::CONFLICT,
                "A template with this name already exists for this DAO".to_string(),
            )
        } else {
            internal_error("Failed to update proposal template", e)
        }
    })?;

    if updated.is_none() {
        return Err((StatusCode::NOT_FOUND, "Template not found".to_string()));
    }

    let row = fetch_template_by_id(&state.db_pool, dao_id.as_str(), id)
        .await
        .map_err(|e| internal_error("Failed to load updated template", e))?
        .ok_or_else(|| internal_error("Updated template vanished", "not found"))?;

    let template =
        ProposalTemplate::try_from(row).map_err(|e| internal_error("Invalid account in template", e))?;

    Ok(Json(template))
}

pub async fn delete_proposal_template(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Path((dao_id, id)): Path<(AccountId, Uuid)>,
) -> Result<StatusCode, (StatusCode, String)> {
    auth_user
        .verify_dao_member(&state.db_pool, &dao_id)
        .await
        .map_err(|_| forbidden())?;

    let result = sqlx::query!(
        "DELETE FROM proposal_templates WHERE dao_id = $1 AND id = $2",
        dao_id.as_str(),
        id
    )
    .execute(&state.db_pool)
    .await
    .map_err(|e| internal_error("Failed to delete proposal template", e))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Template not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use crate::{
        AppState,
        auth::{create_jwt, middleware::AUTH_COOKIE_NAME},
        routes::create_routes,
        utils::test_utils::build_test_state,
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

    fn valid_manifest() -> Value {
        json!({
            "version": 1,
            "id": "ni-recovery-mint",
            "title": "Recovery Mint",
            "binding": { "receiver_id": "omft.near", "method_name": "ft_deposit",
                         "deposit": "1250000000000000000000", "gas": "150000000000000" },
            "fields": [{ "name": "amount", "label": "Amount", "type": "uint", "required": true }],
            "args": { "amount": "{{amount}}" },
            "summary": "Mint {{amount}}"
        })
    }

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

    async fn response_text(response: axum::response::Response) -> String {
        String::from_utf8(
            to_bytes(response.into_body(), usize::MAX)
                .await
                .expect("read body")
                .to_vec(),
        )
        .expect("utf-8 body")
    }

    #[sqlx::test]
    async fn test_proposal_template_crud(pool: PgPool) {
        let state = test_state(pool.clone());
        let app = create_routes(state.clone());

        seed_policy_member(&pool, DAO_ID, USER_ACCOUNT_ID).await;
        let cookie = issue_auth_cookie(&pool, &state, USER_ACCOUNT_ID).await;

        // CREATE
        let create = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/treasury/{DAO_ID}/proposal-templates"))
                    .header("content-type", "application/json")
                    .header("cookie", &cookie)
                    .body(Body::from(
                        json!({ "name": "Recovery Mint", "manifest": valid_manifest() }).to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        let status = create.status();
        let body = response_text(create).await;
        assert_eq!(status, StatusCode::CREATED, "create should succeed: {body}");
        let created: Value = serde_json::from_str(&body).unwrap();
        let id = created["id"].as_str().unwrap().to_string();
        assert_eq!(created["createdBy"].as_str(), Some(USER_ACCOUNT_ID));
        assert_eq!(created["enabled"].as_bool(), Some(true));

        // CREATE duplicate name -> 409
        let dup = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/treasury/{DAO_ID}/proposal-templates"))
                    .header("content-type", "application/json")
                    .header("cookie", &cookie)
                    .body(Body::from(
                        json!({ "name": "Recovery Mint", "manifest": valid_manifest() }).to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(dup.status(), StatusCode::CONFLICT);

        // CREATE invalid manifest -> 400
        let bad = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/treasury/{DAO_ID}/proposal-templates"))
                    .header("content-type", "application/json")
                    .header("cookie", &cookie)
                    .body(Body::from(
                        json!({ "name": "Bad", "manifest": { "id": "" } }).to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(bad.status(), StatusCode::BAD_REQUEST);

        // LIST
        let list = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/api/treasury/{DAO_ID}/proposal-templates"))
                    .header("cookie", &cookie)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(list.status(), StatusCode::OK);
        let listed: Value = serde_json::from_str(&response_text(list).await).unwrap();
        assert_eq!(listed.as_array().unwrap().len(), 1);

        // UPDATE (disable + rename)
        let update = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("PUT")
                    .uri(format!("/api/treasury/{DAO_ID}/proposal-templates/{id}"))
                    .header("content-type", "application/json")
                    .header("cookie", &cookie)
                    .body(Body::from(
                        json!({ "name": "Recovery Mint v2", "enabled": false }).to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(update.status(), StatusCode::OK);
        let updated: Value = serde_json::from_str(&response_text(update).await).unwrap();
        assert_eq!(updated["name"].as_str(), Some("Recovery Mint v2"));
        assert_eq!(updated["enabled"].as_bool(), Some(false));

        // DELETE
        let delete = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(format!("/api/treasury/{DAO_ID}/proposal-templates/{id}"))
                    .header("cookie", &cookie)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(delete.status(), StatusCode::NO_CONTENT);

        // LIST is empty again
        let final_list = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/api/treasury/{DAO_ID}/proposal-templates"))
                    .header("cookie", &cookie)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let final_listed: Value =
            serde_json::from_str(&response_text(final_list).await).unwrap();
        assert!(final_listed.as_array().unwrap().is_empty());
    }

    #[sqlx::test]
    async fn test_non_member_is_forbidden(pool: PgPool) {
        let state = test_state(pool.clone());
        let app = create_routes(state.clone());

        // DAO exists but the user is not a policy member.
        sqlx::query!(
            "INSERT INTO monitored_accounts (account_id) VALUES ($1) ON CONFLICT DO NOTHING",
            DAO_ID,
        )
        .execute(&pool)
        .await
        .unwrap();
        let cookie = issue_auth_cookie(&pool, &state, USER_ACCOUNT_ID).await;

        let resp = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/api/treasury/{DAO_ID}/proposal-templates"))
                    .header("cookie", &cookie)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    }
}
