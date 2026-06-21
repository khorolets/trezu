import axios from "axios";
import type { ProposalTemplate } from "./types";

const BACKEND_API_BASE = `${process.env.NEXT_PUBLIC_BACKEND_API_BASE}/api`;

/** List a DAO's proposal templates (`GET /api/treasury/{dao_id}/proposal-templates`). */
export async function getProposalTemplates(
    daoId: string,
): Promise<ProposalTemplate[]> {
    const response = await axios.get<ProposalTemplate[]>(
        `${BACKEND_API_BASE}/treasury/${encodeURIComponent(daoId)}/proposal-templates`,
        { withCredentials: true },
    );
    return response.data;
}

/** Fields the create endpoint accepts; `manifest` is the raw authored JSON. */
export interface CreateProposalTemplateInput {
    name: string;
    description?: string | null;
    manifest: unknown;
    enabled?: boolean;
}

/**
 * Create a template (`POST /api/treasury/{dao_id}/proposal-templates`). Authoring is gated on the
 * DAO's `ChangePolicy` permission — a member who lacks it gets a 403, surfaced to the author.
 */
export async function createProposalTemplate(
    daoId: string,
    input: CreateProposalTemplateInput,
): Promise<ProposalTemplate> {
    const response = await axios.post<ProposalTemplate>(
        `${BACKEND_API_BASE}/treasury/${encodeURIComponent(daoId)}/proposal-templates`,
        input,
        { withCredentials: true },
    );
    return response.data;
}
