"use client";

import { Info, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type JobMonitorServerCounters = {
  queued: number;
  running: number;
  completed: number;
  failed: number;
  pendingStorage: number;
  total: number;
  oldestQueuedUpdatedAt?: string | null;
};

export type JobWorkerApiStatus = {
  state: "running" | "stopped";
  stats?: { processed?: number; errors?: number; lastTickAt?: number; startedAt?: number };
  concurrency?: number;
  intervalMs?: number;
  workerId?: string;
  jobsWorkerPoolId?: string;
};

export type WorkerHealthIssue = {
  kind: "worker_fetch_failed" | "worker_stopped" | "worker_tick_stale" | "queued_stale";
  message: string;
};

function formatAbsTs(ts?: number): string {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return "—";
  try {
    return new Date(ts).toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "medium",
    });
  } catch {
    return "—";
  }
}

function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} Min.`;
  const h = Math.floor(m / 60);
  return `${h} Std. ${m % 60} Min.`;
}

export function computeWorkerHealth(params: {
  workerStatus: JobWorkerApiStatus | null;
  workerFetchError: string | null;
  counters: JobMonitorServerCounters | null;
  nowMs: number;
}): WorkerHealthIssue | null {
  const { workerStatus, workerFetchError, counters, nowMs } = params;
  if (workerFetchError) {
    return {
      kind: "worker_fetch_failed",
      message: `Worker-Status nicht abrufbar: ${workerFetchError}`,
    };
  }
  const q = counters?.queued ?? 0;
  const r = counters?.running ?? 0;
  if (q === 0) return null;

  if (workerStatus?.state === "stopped") {
    return {
      kind: "worker_stopped",
      message:
        "Der Job-Worker ist gestoppt, obwohl noch Aufträge in der Warteschlange sind.",
    };
  }

  const intervalMs = workerStatus?.intervalMs ?? 2000;
  const staleTickThreshold = Math.max(15_000, intervalMs * 5);
  const lastTick = workerStatus?.stats?.lastTickAt;
  const startedAt = workerStatus?.stats?.startedAt;

  if (
    workerStatus?.state === "running" &&
    typeof lastTick === "number" &&
    nowMs - lastTick > staleTickThreshold &&
    r === 0
  ) {
    return {
      kind: "worker_tick_stale",
      message:
        "Der Worker meldet „läuft“, aber der letzte Tick liegt zu weit zurück (häufig bei Serverless ohne dauerhaften Node-Prozess oder Blockade beim Self-HTTP zur Start-Route).",
    };
  }

  if (
    workerStatus?.state === "running" &&
    lastTick === undefined &&
    typeof startedAt === "number" &&
    nowMs - startedAt > staleTickThreshold &&
    r === 0
  ) {
    return {
      kind: "worker_tick_stale",
      message:
        "Der Worker läuft, aber es wurde noch kein Tick registriert — Background-Polling erreicht diese Instanz vermutlich nicht.",
    };
  }

  const oldestIso = counters?.oldestQueuedUpdatedAt;
  if (oldestIso && r === 0) {
    const age = nowMs - new Date(oldestIso).getTime();
    const queuedStaleThreshold = Math.max(60_000, intervalMs * 10);
    if (Number.isFinite(age) && age > queuedStaleThreshold) {
      return {
        kind: "queued_stale",
        message: `„Queued“-Jobs werden nicht abgeholt: ältester Eintrag unverändert seit ca. ${formatDurationMs(
          age,
        )} (Running: ${r}).`,
      };
    }
  }

  return null;
}

export function JobWorkerHealthBanner({ issue }: { issue: WorkerHealthIssue | null }) {
  if (!issue) return null;
  const isFetch = issue.kind === "worker_fetch_failed";
  return (
    <div
      className={cn(
        "mx-4 mt-2 mb-1 rounded-md border px-3 py-2 text-xs leading-snug",
        isFetch
          ? "border-destructive/50 bg-destructive/10 text-destructive"
          : "border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-100",
      )}
      role="status"
    >
      {issue.message}
    </div>
  );
}

type InfoPopoverProps = {
  workerStatus: JobWorkerApiStatus | null;
  workerFetchError: string | null;
  serverCounts: JobMonitorServerCounters | null;
  healthIssue: WorkerHealthIssue | null;
  onRefresh: () => void | Promise<void>;
  isRefreshing?: boolean;
};

export function JobWorkerInfoPopover({
  workerStatus,
  workerFetchError,
  serverCounts,
  healthIssue,
  onRefresh,
  isRefreshing,
}: InfoPopoverProps) {
  const st = workerStatus;
  const stats = st?.stats;

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) void onRefresh();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="pointer-events-auto inline-flex rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Detaillierter Worker- und Queue-Status"
          title="Worker-Details und Diagnose"
        >
          <Info className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(92vw,26rem)] max-h-[min(70vh,32rem)] overflow-y-auto text-xs"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="font-semibold text-sm">Job-Worker & Warteschlange</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => void onRefresh()}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
          </Button>
        </div>

        {workerFetchError ? (
          <p className="mb-2 rounded border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-destructive">
            API /api/external/jobs/worker: {workerFetchError}
          </p>
        ) : null}

        {healthIssue ? (
          <p className="mb-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-amber-950 dark:text-amber-100">
            {healthIssue.message}
          </p>
        ) : null}

        <dl className="space-y-1.5 border-b pb-2 mb-2">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Prozess-State</dt>
            <dd className="text-right font-mono">{st?.state ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Worker-Pool-ID</dt>
            <dd className="text-right font-mono break-all">{st?.jobsWorkerPoolId ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Worker-Instanz (UUID)</dt>
            <dd className="text-right font-mono break-all text-[10px]">{st?.workerId ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Intervall</dt>
            <dd className="text-right font-mono">{st?.intervalMs ?? "—"} ms</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Concurrency</dt>
            <dd className="text-right font-mono">{st?.concurrency ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Gestartet um</dt>
            <dd className="text-right">{formatAbsTs(stats?.startedAt)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Letzter Tick</dt>
            <dd className="text-right">{formatAbsTs(stats?.lastTickAt)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Dispatch ok (processed)</dt>
            <dd className="text-right font-mono">{stats?.processed ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Dispatch-Fehler (errors)</dt>
            <dd className="text-right font-mono">{stats?.errors ?? "—"}</dd>
          </div>
        </dl>

        <p className="mb-1 font-medium text-[11px] text-muted-foreground">Zähler (Server, aktuelle Filter)</p>
        <dl className="space-y-1.5 border-b pb-2 mb-2">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Queued / Running</dt>
            <dd className="text-right font-mono">
              {serverCounts?.queued ?? "—"} / {serverCounts?.running ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Ältestes Queued (updatedAt)</dt>
            <dd className="text-right text-[10px] font-mono break-all">
              {serverCounts?.oldestQueuedUpdatedAt
                ? new Date(serverCounts.oldestQueuedUpdatedAt).toLocaleString(undefined, {
                    dateStyle: "short",
                    timeStyle: "medium",
                  })
                : "—"}
            </dd>
          </div>
        </dl>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Hinweis: „Worker läuft“ bezieht sich nur auf die <strong>Server-Instanz</strong>, die die
          Status-API bedient hat. Ohne lang laufenden Node-Prozess können Ticks ausbleiben — dann steigt
          „processed“ nicht und Queues bleiben stehen. Prüfen Sie{" "}
          <code className="rounded bg-muted px-0.5">NEXT_PUBLIC_APP_URL</code> /{" "}
          <code className="rounded bg-muted px-0.5">INTERNAL_SELF_BASE_URL</code> und{" "}
          <code className="rounded bg-muted px-0.5">JOBS_WORKER_POOL_ID</code>.
        </p>
      </PopoverContent>
    </Popover>
  );
}
