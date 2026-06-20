import { describe, expect, it } from "bun:test";
import { base64ToJson } from "@/lib/utils";
import { buildTemplateProposal, interpolateArgs } from "./build-proposal";
import {
    type Manifest,
    manifestErrorMessages,
    parseManifest,
} from "./manifest";

/** Parse a fixture through the real validator so the engine is only ever fed valid manifests. */
function manifest(raw: unknown): Manifest {
    const result = parseManifest(raw);
    if (!result.success) {
        throw new Error(manifestErrorMessages(result.error).join("; "));
    }
    return result.data;
}

// The staging NEAR-Intents recovery-mint (one `ft_deposit` call), modelled as a manifest.
const rawMint = {
    version: 1,
    id: "ni-recovery-mint",
    title: "Recovery Mint",
    binding: {
        receiver_id: "stft.near",
        method_name: "ft_deposit",
        deposit: "1250000000000000000000",
        gas: "150000000000000",
    },
    fields: [
        { name: "token", label: "Token", type: "token" },
        { name: "amount", label: "Amount", type: "uint" },
        { name: "receiver", label: "Receiver (hex)", type: "text" },
        { name: "tx_hash", label: "Source tx hash", type: "text" },
    ],
    args: {
        owner_id: "staging-intents.near",
        token: "{{token}}",
        amount: "{{amount}}",
        msg: '{"receiver_id":"{{receiver}}"}',
        memo: 'BRIDGED_FROM:{"networkType":"eth","chainId":"8453","txHash":"{{tx_hash}}"}',
    },
    summary: "Mint {{amount}} of {{token}} to {{receiver}}",
};

const mintValues = {
    token: "base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    amount: "101021",
    receiver: "a1b2c3deadbeef",
    tx_hash: "0xabc123",
};

describe("interpolateArgs", () => {
    it("substitutes placeholders in nested strings, arrays, and objects", () => {
        const out = interpolateArgs(
            { a: "{{x}}", b: ["{{y}}", { c: "z={{x}}" }], n: 5 },
            { x: "X", y: "Y" },
        );
        expect(out).toEqual({ a: "X", b: ["Y", { c: "z=X" }], n: 5 });
    });

    it("resolves a missing value to an empty string", () => {
        expect(interpolateArgs("{{absent}}", {})).toBe("");
    });

    it("stringifies number, boolean, and json values", () => {
        expect(
            interpolateArgs("{{n}}/{{b}}/{{j}}", {
                n: 7,
                b: true,
                j: { k: 1 },
            }),
        ).toBe('7/true/{"k":1}');
    });

    it("collapses an escaped {{{{literal}}}} to {{literal}}", () => {
        expect(interpolateArgs("{{{{keep}}}} {{x}}", { x: "X" })).toBe(
            "{{keep}} X",
        );
    });

    it("returns an empty args object unchanged", () => {
        expect(interpolateArgs({}, {})).toEqual({});
    });

    it("tolerates whitespace inside a placeholder ({{ name }})", () => {
        expect(interpolateArgs("{{ x }}", { x: "X" })).toBe("X");
    });
});

describe("buildTemplateProposal", () => {
    it("reproduces the recovery-mint ft_deposit call exactly", () => {
        const { kind } = buildTemplateProposal(manifest(rawMint), mintValues);
        const fc = kind.FunctionCall;

        expect(fc.receiver_id).toBe("stft.near");
        expect(fc.actions).toHaveLength(1);

        const action = fc.actions[0];
        expect(action.method_name).toBe("ft_deposit");
        expect(action.deposit).toBe("1250000000000000000000");
        expect(action.gas).toBe("150000000000000");
        expect(base64ToJson(action.args)).toEqual({
            owner_id: "staging-intents.near",
            token: "base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
            amount: "101021",
            msg: '{"receiver_id":"a1b2c3deadbeef"}',
            memo: 'BRIDGED_FROM:{"networkType":"eth","chainId":"8453","txHash":"0xabc123"}',
        });
    });

    it("keeps a u128 amount as a digit string (never a JS number)", () => {
        const big = "340282366920938463463374607431768211455"; // 2^128 - 1
        const { kind } = buildTemplateProposal(manifest(rawMint), {
            ...mintValues,
            amount: big,
        });
        expect(base64ToJson(kind.FunctionCall.actions[0].args).amount).toBe(
            big,
        );
    });

    it("tags the description with [trezu-tmpl:<id>] and interpolates the summary", () => {
        const { description } = buildTemplateProposal(
            manifest(rawMint),
            mintValues,
        );
        expect(description).toContain("[trezu-tmpl:ni-recovery-mint]");
        expect(description).toContain("Mint 101021");
    });

    it("falls back to the title when no summary is declared", () => {
        const { description } = buildTemplateProposal(
            manifest({ ...rawMint, summary: undefined }),
            mintValues,
        );
        expect(description).toContain("Recovery Mint");
    });
});
