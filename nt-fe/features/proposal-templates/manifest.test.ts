import { describe, expect, it } from "bun:test";
import { manifestErrorMessages, parseManifest } from "./manifest";

const validManifest = {
    version: 1,
    id: "ni-recovery-mint",
    title: "Recovery Mint",
    binding: {
        receiver_id: "omft.near",
        method_name: "ft_deposit",
        deposit: "1250000000000000000000",
        gas: "150000000000000",
    },
    fields: [{ name: "amount", label: "Amount", type: "uint", required: true }],
    args: { amount: "{{amount}}" },
    summary: "Mint {{amount}}",
};

describe("parseManifest", () => {
    it("accepts a valid manifest and trims its string fields", () => {
        const result = parseManifest({
            ...validManifest,
            id: "  ni-recovery-mint  ",
            title: "  Recovery Mint  ",
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.id).toBe("ni-recovery-mint");
            expect(result.data.title).toBe("Recovery Mint");
        }
    });

    it("rejects a non-object", () => {
        expect(parseManifest("not an object").success).toBe(false);
    });

    it("rejects a blank id", () => {
        expect(parseManifest({ ...validManifest, id: "   " }).success).toBe(
            false,
        );
    });

    it("rejects a missing binding field", () => {
        const result = parseManifest({
            ...validManifest,
            binding: { method_name: "ft_deposit", deposit: "1", gas: "1" },
        });
        expect(result.success).toBe(false);
    });

    it("rejects a non-integer deposit (u128 must be an integer string)", () => {
        const result = parseManifest({
            ...validManifest,
            binding: { ...validManifest.binding, deposit: "1.5" },
        });
        expect(result.success).toBe(false);
    });

    it("rejects an unknown field type", () => {
        const result = parseManifest({
            ...validManifest,
            fields: [{ name: "x", label: "X", type: "bogus" }],
        });
        expect(result.success).toBe(false);
    });

    it("rejects a non-integer validation.min on a field", () => {
        const result = parseManifest({
            ...validManifest,
            fields: [
                {
                    name: "amount",
                    label: "Amount",
                    type: "uint",
                    validation: { min: "1.5" },
                },
            ],
        });
        expect(result.success).toBe(false);
    });

    it("rejects args that is not an object", () => {
        expect(
            parseManifest({ ...validManifest, args: ["not", "a", "record"] })
                .success,
        ).toBe(false);
    });

    it("rejects an args/summary placeholder that no field declares", () => {
        const result = parseManifest({
            ...validManifest,
            args: { amount: "{{missing}}" },
        });
        expect(result.success).toBe(false);
    });
});

describe("manifestErrorMessages", () => {
    it("returns `path: message` lines for each issue", () => {
        const result = parseManifest({ ...validManifest, id: "" });
        expect(result.success).toBe(false);
        if (!result.success) {
            const messages = manifestErrorMessages(result.error);
            expect(messages.length).toBeGreaterThan(0);
            expect(messages.some((m) => m.startsWith("id:"))).toBe(true);
        }
    });
});
