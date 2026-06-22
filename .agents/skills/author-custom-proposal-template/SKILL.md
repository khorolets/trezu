---
name: author-custom-proposal-template
description: Author or edit a trezu custom-proposal template manifest — the JSON DSL that renders a form members fill to file a SputnikDAO FunctionCall proposal. Use when writing a manifest, wiring fields to args with {{placeholders}}, picking field types, or fixing "must be a tag-safe slug" / "references a {{placeholder}} that no field declares" errors.
---

# Authoring a custom-proposal template manifest

A manifest is JSON that defines a form. Members fill it; trezu files one SputnikDAO
`FunctionCall` proposal from it. Full reference: `docs/CUSTOM_PROPOSAL_TEMPLATES.md`.
Validator: `nt-fe/features/proposal-templates/manifest.ts` (`parseManifest`) — produce
manifests that pass it.

## Shape

```json
{
  "version": 1,
  "id": "guestbook-tip",          // tag-safe slug [A-Za-z0-9_-], unique per DAO,
                                   //   NOT create/new/about
  "title": "Guestbook Tip",
  "summary": "Tip {{amount}}",    // optional; may use {{fields}}
  "binding": {                    // the fixed on-chain call
    "receiver_id": "guestbook.near",
    "method_name": "add_message",
    "deposit": "1",                       // yoctoNEAR, INTEGER STRING
    "gas": "30000000000000"               // INTEGER STRING
  },
  "fields": [                     // the form inputs
    { "name": "amount", "label": "Amount", "type": "uint", "required": true }
  ],
  "args": { "amount": "{{amount}}" }       // method args; {{name}} -> field value
}
```

## Rules that trip authors up

- **`id`**: `[A-Za-z0-9_-]` only, and not a reserved route slug (`create`/`new`/`about`).
- **field `name`**: `[A-Za-z0-9_]` only (placeholder-safe), unique within the manifest.
- **`deposit`/`gas`/`validation.min`/`max` and `uint`/`amount` values are integer
  strings** in base units — no decimals, never JSON numbers (NEAR amounts exceed 2^53).
  `1.1 NEAR` is `"1100000000000000000000000"`.
- **Every `{{placeholder}}` in `args` or `summary` must reference a declared field**, or
  parse fails ("references a {{placeholder}} that no field declares").
- `required` is invalid on a `bool` field. `options` is required on `select`, forbidden
  elsewhere. A `default` must match the field `type`. `validation.pattern` only on
  `text`/`number`; `min`/`max` only on `uint`/`amount`/`number`.

## Field types

`account` · `token` (omni id like `base-0x…`) · `uint` · `amount` (both u128 integer
strings) · `number` (f64, for counts/ratios, not amounts) · `text` · `select` (needs
`options`) · `bool` · `json`.

## Wiring fields into args

- **Direct value**: `"amount": "{{amount}}"`.
- **Composed / concatenated**: `"recipient": "{{first}}.{{last}}"` → `"alice.near"`.
- **Field inside a JSON-string arg**: `"msg": "{\"receiver_id\":\"{{receiver}}\"}"`.
- **Static value**: a literal with no placeholder (`"app": "trezu"`).
- An input you collect but don't send anywhere (no arg, no summary) is valid but rare —
  use only for acknowledgment toggles or forward-compat.

## Output

Emit the manifest JSON, then sanity-check it against the rules above (or `parseManifest`
if you can run it). For a worked non-trivial example, see the doc.
