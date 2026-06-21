import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTreasury } from "@/hooks/use-treasury";
import {
    type CreateProposalTemplateInput,
    createProposalTemplate,
} from "../api";

/** Create a proposal template for the current treasury, invalidating the list on success. */
export function useCreateProposalTemplate() {
    const { treasuryId } = useTreasury();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: CreateProposalTemplateInput) =>
            createProposalTemplate(treasuryId as string, input),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["proposal-templates", treasuryId],
            });
        },
    });
}
