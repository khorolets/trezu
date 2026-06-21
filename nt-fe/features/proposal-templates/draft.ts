/**
 * Editable draft model for the visual constructor, and lossless conversion to/from a manifest.
 *
 * The visual builder edits a `ManifestDraft` (flat strings for the meta/binding, a list for fields,
 * and an `ArgNode` tree mirroring `args`) rather than raw JSON. `manifestToDraft` hydrates it from a
 * parsed manifest (e.g. when switching from Code mode), and `draftToManifest` serializes it back to
 * a manifest object that `parseManifest` then validates — so the builder shares one source of truth
 * with code mode and can never emit a shape the backend would reject.
 *
 * Round-trip is the contract: `draftToManifest(manifestToDraft(m))` re-parses to `m`. The unit tests
 * pin that for the mint template, every field type, validations, and the optional meta fields.
 */
import type { Manifest, ManifestField, ManifestFieldType } from "./manifest";

/**
 * A node in the `args` tree — an editable mirror of a JSON value. String leaves may embed
 * `{{field}}` placeholders (the fill engine substitutes them); the builder decides how to present a
 * string (plain / single field-ref / templated) but the model just stores the raw string.
 */
export type ArgNode =
    | { kind: "object"; entries: ArgEntry[] }
    | { kind: "array"; items: ArgNode[] }
    | { kind: "string"; value: string }
    | { kind: "number"; value: number }
    | { kind: "boolean"; value: boolean }
    | { kind: "null" };

export interface ArgEntry {
    key: string;
    value: ArgNode;
}

/** Build an args node from a parsed JSON value. */
export function jsonToArgNode(value: unknown): ArgNode {
    if (value === null) {
        return { kind: "null" };
    }
    if (typeof value === "string") {
        return { kind: "string", value };
    }
    if (typeof value === "number") {
        return { kind: "number", value };
    }
    if (typeof value === "boolean") {
        return { kind: "boolean", value };
    }
    if (Array.isArray(value)) {
        return { kind: "array", items: value.map(jsonToArgNode) };
    }
    if (typeof value === "object") {
        return {
            kind: "object",
            entries: Object.entries(value as Record<string, unknown>).map(
                ([key, child]) => ({ key, value: jsonToArgNode(child) }),
            ),
        };
    }
    // undefined / function / symbol never appear in parsed JSON; collapse to null defensively.
    return { kind: "null" };
}

/** Serialize an args node back to a JSON value. */
export function argNodeToJson(node: ArgNode): unknown {
    switch (node.kind) {
        case "null":
            return null;
        case "string":
            return node.value;
        case "number":
            return node.value;
        case "boolean":
            return node.value;
        case "array":
            return node.items.map(argNodeToJson);
        case "object":
            return argEntriesToJson(node.entries);
    }
}

function argEntriesToJson(entries: ArgEntry[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const entry of entries) {
        result[entry.key] = argNodeToJson(entry.value);
    }
    return result;
}

/** A field row in the builder. Optional manifest bits become empty strings / `[]` / `undefined`. */
export interface FieldDraft {
    name: string;
    label: string;
    type: ManifestFieldType;
    required: boolean;
    help: string;
    /** The typed default value, or `undefined` for none. The builder coerces input per `type`. */
    default: unknown;
    /** Choices for a `select` field. */
    options: string[];
    validation: { min: string; max: string; pattern: string };
}

/** The whole editable manifest. `args` holds the top-level object's entries (args is always an object). */
export interface ManifestDraft {
    id: string;
    title: string;
    description: string;
    icon: string;
    summary: string;
    binding: {
        receiver_id: string;
        method_name: string;
        deposit: string;
        gas: string;
    };
    fields: FieldDraft[];
    args: ArgEntry[];
}

/** A blank draft for a new template (sensible gas/deposit defaults; everything else empty). */
export function emptyDraft(): ManifestDraft {
    return {
        id: "",
        title: "",
        description: "",
        icon: "",
        summary: "",
        binding: {
            receiver_id: "",
            method_name: "",
            deposit: "0",
            gas: "30000000000000",
        },
        fields: [],
        args: [],
    };
}

function fieldToDraft(field: ManifestField): FieldDraft {
    return {
        name: field.name,
        label: field.label,
        type: field.type,
        required: field.required ?? false,
        help: field.help ?? "",
        default: field.default,
        options: field.options ?? [],
        validation: {
            min: field.validation?.min ?? "",
            max: field.validation?.max ?? "",
            pattern: field.validation?.pattern ?? "",
        },
    };
}

function draftToField(field: FieldDraft): Record<string, unknown> {
    // Only emit `options`/`validation` bits the field's type actually permits, so switching a
    // field's type in the builder can't leave stale data that the schema then rejects.
    const numeric =
        field.type === "uint" ||
        field.type === "amount" ||
        field.type === "number";
    const patternable = field.type === "text" || field.type === "number";
    const validation: Record<string, unknown> = {};
    if (numeric && field.validation.min) {
        validation.min = field.validation.min;
    }
    if (numeric && field.validation.max) {
        validation.max = field.validation.max;
    }
    if (patternable && field.validation.pattern) {
        validation.pattern = field.validation.pattern;
    }
    return {
        name: field.name,
        label: field.label,
        type: field.type,
        ...(field.required ? { required: true } : {}),
        ...(field.help ? { help: field.help } : {}),
        ...(field.default !== undefined ? { default: field.default } : {}),
        ...(field.type === "select" && field.options.length > 0
            ? { options: field.options }
            : {}),
        ...(Object.keys(validation).length > 0 ? { validation } : {}),
    };
}

/** Hydrate a draft from a validated manifest (e.g. when switching Code → Visual). */
export function manifestToDraft(manifest: Manifest): ManifestDraft {
    const argsNode = jsonToArgNode(manifest.args);
    return {
        id: manifest.id,
        title: manifest.title,
        description: manifest.description ?? "",
        icon: manifest.icon ?? "",
        summary: manifest.summary ?? "",
        binding: {
            receiver_id: manifest.binding.receiver_id,
            method_name: manifest.binding.method_name,
            deposit: manifest.binding.deposit,
            gas: manifest.binding.gas,
        },
        fields: manifest.fields.map(fieldToDraft),
        args: argsNode.kind === "object" ? argsNode.entries : [],
    };
}

/**
 * Serialize a draft to a manifest object. Not validated here — the caller runs `parseManifest` so
 * the visual and code paths share one validator. Optional meta fields are omitted when blank.
 */
export function draftToManifest(draft: ManifestDraft): Record<string, unknown> {
    return {
        version: 1,
        id: draft.id,
        title: draft.title,
        ...(draft.description ? { description: draft.description } : {}),
        ...(draft.icon ? { icon: draft.icon } : {}),
        binding: {
            receiver_id: draft.binding.receiver_id,
            method_name: draft.binding.method_name,
            deposit: draft.binding.deposit,
            gas: draft.binding.gas,
        },
        fields: draft.fields.map(draftToField),
        args: argEntriesToJson(draft.args),
        ...(draft.summary ? { summary: draft.summary } : {}),
    };
}
