import { describe, expect, it } from "bun:test";
import { errorFor } from "./error-map";

const errors = [
    "id: id must be a tag-safe slug",
    "binding.receiver_id: binding.receiver_id must not be blank",
    "fields.0.name: required",
];

describe("errorFor", () => {
    it("strips the leading field token so the message reads cleanly", () => {
        expect(errorFor(errors, "id")).toBe("Must be a tag-safe slug");
        expect(errorFor(errors, "binding.receiver_id")).toBe(
            "Must not be blank",
        );
    });

    it("capitalizes a message that has no leading field token", () => {
        expect(errorFor(errors, "fields.0.name")).toBe("Required");
    });

    it("does not match a different path that shares a prefix", () => {
        expect(errorFor(["icon: bad"], "id")).toBeUndefined();
        // "fields" must not swallow "fields.0.name".
        expect(errorFor(["fields.0.name: x"], "fields")).toBeUndefined();
    });

    it("returns undefined when nothing matches", () => {
        expect(errorFor(errors, "title")).toBeUndefined();
    });
});
