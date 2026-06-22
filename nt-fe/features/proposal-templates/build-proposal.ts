/**
 * Template engine for the custom-proposal framework: turn a validated manifest plus the values a
 * member filled in the rendered form into the exact SputnikDAO `FunctionCall` proposal — `kind` +
 * `description` — that `createProposal` (stores/near-store) submits.
 *
 * Pure and framework-free, so it unit-tests without React or a wallet, and it reuses the manifest
 * module's `substitutePlaceholders` so the args it emits can never drift from what the validator
 * checked. v1 substitution is string-based: every `{{field}}` resolves to a string (NEAR amounts
 * stay digit strings, so u128 values never round-trip through a JS number). Typed JSON injection
 * (a `bool`/`json` field landing as a raw value rather than a string) is a deliberate non-goal here
 * — every v1 binding expresses its args as strings.
 */
import type { FunctionCallKind } from "@/lib/proposals-api";
import { encodeToMarkdown, jsonToBase64 } from "@/lib/utils";
import { type Manifest, substitutePlaceholders } from "./manifest";

/** Values a member filled, keyed by field `name`. */
export type FieldValues = Record<string, unknown>;

/** The on-chain proposal a template produces: a `FunctionCall` kind and its description. */
export interface TemplateProposal {
    kind: FunctionCallKind;
    description: string;
}

/** Coerce a field value into the string that replaces its `{{placeholder}}`. */
function resolveValue(value: unknown): string {
    if (value === undefined || value === null) {
        return "";
    }
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    // A `json` field's object/array value injects its JSON text (e.g. a stringified `msg`).
    return JSON.stringify(value);
}

/** Interpolate `{{field}}` placeholders in a single string — the one path both args and summary use. */
function interpolateString(text: string, values: FieldValues): string {
    return substitutePlaceholders(text, (name) => resolveValue(values[name]));
}

/** Recursively interpolate `{{field}}` placeholders through an args template using `values`. */
export function interpolateArgs(
    template: unknown,
    values: FieldValues,
): unknown {
    if (typeof template === "string") {
        return interpolateString(template, values);
    }
    if (Array.isArray(template)) {
        return template.map((item) => interpolateArgs(item, values));
    }
    if (template !== null && typeof template === "object") {
        const out: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(template)) {
            out[key] = interpolateArgs(item, values);
        }
        return out;
    }
    return template;
}

/**
 * Build the `{ kind, description }` an authored `manifest` and a member's `values` produce.
 *
 * The description carries the `[trezu-tmpl:<id>]` tag so a created proposal is traceable back to
 * the template that minted it (the manifest `id` is constrained to a tag-safe slug for exactly
 * this). `deposit`/`gas` come verbatim from the manifest `binding` (digit strings, never numbers).
 */
export function buildTemplateProposal(
    manifest: Manifest,
    values: FieldValues,
): TemplateProposal {
    const args = interpolateArgs(manifest.args, values);
    const kind: FunctionCallKind = {
        FunctionCall: {
            receiver_id: manifest.binding.receiver_id,
            actions: [
                {
                    method_name: manifest.binding.method_name,
                    args: jsonToBase64(args),
                    deposit: manifest.binding.deposit,
                    gas: manifest.binding.gas,
                },
            ],
        },
    };

    const summary = manifest.summary
        ? interpolateString(manifest.summary, values)
        : manifest.title;
    const description = encodeToMarkdown({
        proposal_action: "custom",
        template: `[trezu-tmpl:${manifest.id}]`,
        summary,
    });

    return { kind, description };
}
