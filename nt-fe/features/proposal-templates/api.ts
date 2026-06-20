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
