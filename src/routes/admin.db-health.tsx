import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw } from "lucide-react";

import { BuilderShell, PageHeader } from "@/components/builder/BuilderShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDbHealth } from "@/lib/api/db-health.functions";
import { currentUser } from "@/lib/mock-store";

export const Route = createFileRoute("/admin/db-health")({
  head: () => ({ meta: [{ title: "BBS AI Builder — Adatbázis állapot" }] }),
  component: DbHealthPage,
});

function DbHealthPage() {
  const { t } = useTranslation();
  const viewer = currentUser();
  const isAdmin = Boolean(viewer?.isGlobalSuperadmin || viewer?.roles?.includes("builder_admin"));

  const fetchHealth = useServerFn(getDbHealth);
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["db-health"],
    queryFn: () => fetchHealth(),
    enabled: isAdmin,
    refetchOnWindowFocus: false,
  });

  if (!isAdmin) {
    return (
      <BuilderShell title={t("dbHealth.title")}>
        <PageHeader title={t("dbHealth.title")} />
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">{t("dbHealth.adminOnly")}</p>
          </CardContent>
        </Card>
      </BuilderShell>
    );
  }

  return (
    <BuilderShell title={t("dbHealth.title")} subtitle={t("dbHealth.subtitle")}>
      <PageHeader title={t("dbHealth.title")} subtitle={t("dbHealth.subtitle")} />

      <div className="mb-4 flex items-center gap-2">
        <Button onClick={() => refetch()} disabled={isFetching} size="sm" variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          {t("dbHealth.refresh")}
        </Button>
        {data?.checkedAt && (
          <span className="text-xs text-muted-foreground">
            {t("dbHealth.checkedAt")}: {new Date(data.checkedAt).toLocaleString()}
          </span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t("dbHealth.mode.label")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data ? (
              <Badge variant={data.mode === "real" ? "default" : "secondary"}>
                {data.mode === "real" ? t("dbHealth.mode.real") : t("dbHealth.mode.mock")}
              </Badge>
            ) : (
              <span className="text-sm text-muted-foreground">{t("common.loading")}</span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t("dbHealth.connection.label")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!data ? (
              <span className="text-sm text-muted-foreground">{t("common.loading")}</span>
            ) : !data.databaseConfigured ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                {t("dbHealth.connection.notConfigured")}
              </div>
            ) : data.connectionOk ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  {t("dbHealth.connection.ok")}
                </div>
                {data.serverVersion && (
                  <div className="text-xs text-muted-foreground font-mono">
                    MySQL {data.serverVersion}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <XCircle className="h-4 w-4 text-destructive" />
                  {t("dbHealth.connection.failed")}
                </div>
                {data.errorMessage && (
                  <div className="text-xs text-destructive font-mono break-all">{data.errorMessage}</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t("dbHealth.notes.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            <li>{t("dbHealth.notes.readOnly")}</li>
            <li>{t("dbHealth.notes.failFast")}</li>
            <li>{t("dbHealth.notes.rollback")}</li>
          </ul>
        </CardContent>
      </Card>
    </BuilderShell>
  );
}
