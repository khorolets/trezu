import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTreasury } from "@/hooks/use-treasury";
import {
    type CreateProposalTemplateInput,
    createProposalTemplate,
    deleteProposalTemplate,
    type UpdateProposalTemplateInput,
    updateProposalTemplate,
} from "../api";

/** Invalidate the current treasury's template list after any mutation. */
function useInvalidateTemplates(treasuryId: string | undefined) {
    const queryClient = useQueryClient();
    return () =>
        queryClient.invalidateQueries({
            queryKey: ["proposal-templates", treasuryId],
        });
}

/** Create a proposal template for the current treasury, invalidating the list on success. */
export function useCreateProposalTemplate() {
    const { treasuryId } = useTreasury();
    const invalidate = useInvalidateTemplates(treasuryId);

    return useMutation({
        mutationFn: (input: CreateProposalTemplateInput) =>
            createProposalTemplate(treasuryId as string, input),
        onSuccess: invalidate,
    });
}

/** Update a template by id, invalidating the list on success. */
export function useUpdateProposalTemplate() {
    const { treasuryId } = useTreasury();
    const invalidate = useInvalidateTemplates(treasuryId);

    return useMutation({
        mutationFn: ({
            id,
            input,
        }: {
            id: string;
            input: UpdateProposalTemplateInput;
        }) => updateProposalTemplate(treasuryId as string, id, input),
        onSuccess: invalidate,
    });
}

/** Delete a template by id, invalidating the list on success. */
export function useDeleteProposalTemplate() {
    const { treasuryId } = useTreasury();
    const invalidate = useInvalidateTemplates(treasuryId);

    return useMutation({
        mutationFn: (id: string) =>
            deleteProposalTemplate(treasuryId as string, id),
        onSuccess: invalidate,
    });
}
