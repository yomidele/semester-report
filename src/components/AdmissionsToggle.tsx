import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ClipboardCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useCollegeSettings } from "@/lib/college-settings";
import { setAdmissionsOpen } from "@/lib/applicant.functions";
import { toast } from "sonner";

/** Shown on both the Super Admin and Admission Officer dashboards — either
 *  role can open or close the public /apply form. See setAdmissionsOpen for
 *  why this is a dedicated server function rather than a direct RLS grant. */
export function AdmissionsToggle() {
  const { settings, isLoading } = useCollegeSettings();
  const queryClient = useQueryClient();
  const toggle = useServerFn(setAdmissionsOpen);

  const mutation = useMutation({
    mutationFn: (open: boolean) => toggle({ data: { open } }),
    onSuccess: (_, open) => {
      toast.success(open ? "Public admissions are now open" : "Public admissions are now closed");
      queryClient.invalidateQueries({ queryKey: ["college-settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card className="tsu-shadow">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-start gap-3">
          <ClipboardCheck className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <Label htmlFor="admissions-open" className="text-sm font-semibold">
              Public admission applications
            </Label>
            <p className="text-xs text-muted-foreground">
              {settings.admissions_open
                ? "Visitors can apply for a class from the homepage right now."
                : "The homepage apply form is closed — visitors can't submit new applications."}
            </p>
          </div>
        </div>
        {isLoading || mutation.isPending ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
        ) : (
          <Switch
            id="admissions-open"
            checked={settings.admissions_open}
            onCheckedChange={(checked) => mutation.mutate(checked)}
          />
        )}
      </CardContent>
    </Card>
  );
}
