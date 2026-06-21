/**
 * The args-tree editor's value-type layer over `ArgNode`. The model stores string leaves as plain
 * strings (which may embed `{{field}}` placeholders); the editor presents a friendlier type choice
 * where a string is either a single-field reference ("field") or free "text". These pure helpers
 * map between the two and seed new nodes — kept out of the component so they're unit-testable.
 */
import type { ArgNode } from "./draft";

export type ArgValueType =
    | "text"
    | "field"
    | "number"
    | "boolean"
    | "null"
    | "object"
    | "array";

export const ARG_VALUE_TYPES: ArgValueType[] = [
    "text",
    "field",
    "number",
    "boolean",
    "null",
    "object",
    "array",
];

/** A string that is exactly one `{{field}}` placeholder (group 1 = the field name). */
export const SINGLE_FIELD_RE = /^\{\{\s*([a-zA-Z0-9_]+)\s*\}\}$/;

/** The editor value-type for a node — a string is "field" iff it's a lone placeholder. */
export function valueTypeOf(node: ArgNode): ArgValueType {
    switch (node.kind) {
        case "object":
            return "object";
        case "array":
            return "array";
        case "number":
            return "number";
        case "boolean":
            return "boolean";
        case "null":
            return "null";
        case "string":
            return SINGLE_FIELD_RE.test(node.value) ? "field" : "text";
    }
}

/** A fresh node for a chosen type; a "field" node seeds the first declared field, if any. */
export function emptyNodeOf(type: ArgValueType, fieldNames: string[]): ArgNode {
    switch (type) {
        case "object":
            return { kind: "object", entries: [] };
        case "array":
            return { kind: "array", items: [] };
        case "number":
            return { kind: "number", value: 0 };
        case "boolean":
            return { kind: "boolean", value: false };
        case "null":
            return { kind: "null" };
        case "field":
            return {
                kind: "string",
                value: fieldNames[0] ? `{{${fieldNames[0]}}}` : "",
            };
        case "text":
            return { kind: "string", value: "" };
    }
}

/** Change a node's type, preserving the string content when staying within string kinds. */
export function changeType(
    node: ArgNode,
    type: ArgValueType,
    fieldNames: string[],
): ArgNode {
    if (node.kind === "string") {
        if (type === "text") {
            return node;
        }
        if (type === "field") {
            return SINGLE_FIELD_RE.test(node.value)
                ? node
                : emptyNodeOf("field", fieldNames);
        }
    }
    return emptyNodeOf(type, fieldNames);
}
