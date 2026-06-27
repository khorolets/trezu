"use client";

import { CodeXml } from "lucide-react";
/**
 * Settings → Developer tab. Hosts the opt-in for Custom Requests (the custom-proposal-templates
 * feature). Enabling it (ChangePolicy-gated server-side) reveals the Request Templates section in
 * the sidebar; right after, we run the one-step onboarding tour that points at it.
 */
import { useNextStep } from "nextstepjs";
import { toast } from "sonner";
import { Button } from "@/components/button";
import { PageCard } from "@/components/card";
import { REQUEST_TEMPLATES_TOUR_NAME } from "@/features/onboarding/steps/page-tours";
import { apiErrorMessage } from "@/features/proposal-templates/api";
import {
    useCustomRequestsEnabled,
    useSetCustomRequestsEnabled,
} from "@/features/proposal-templates/hooks/use-custom-requests-enabled";

export function DeveloperTab() {
    const { data: enabled, isLoading } = useCustomRequestsEnabled();
    const setEnabled = useSetCustomRequestsEnabled();
    const { startNextStep } = useNextStep();

    function toggle(next: boolean) {
        setEnabled.mutate(next, {
            onSuccess: () => {
                if (next) {
                    // Let the sidebar render the freshly revealed item before pointing the tour at it.
                    setTimeout(
                        () => startNextStep(REQUEST_TEMPLATES_TOUR_NAME),
                        400,
                    );
                }
            },
            onError: (error) =>
                toast.error(
                    apiErrorMessage(error, "Could not update the setting"),
                ),
        });
    }

    return (
        <PageCard>
            <div className="flex items-start gap-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <CodeXml className="size-5" />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                    <h3 className="font-semibold text-base">Custom Requests</h3>
                    <p className="text-muted-foreground text-sm">
                        Build your own request types when you need more than
                        payments and exchange. Add the fields you need and your
                        members can submit them like any other request.
                    </p>
                </div>
                <Button
                    variant={enabled ? "outline" : "default"}
                    disabled={isLoading || setEnabled.isPending}
                    onClick={() => toggle(!enabled)}
                >
                    {enabled ? "Disable" : "Enable"}
                </Button>
            </div>
        </PageCard>
    );
}
