import { useEffect, useRef, useState } from "react";
import {
  ADMIN_REPORT_PAGE_SIZE,
  getReports,
  getReportStats,
  updateReportStatus,
} from "../api/admin";
import {
  ADMIN_EXPIRED_KEY_MESSAGE,
  getAdminFailure,
} from "../api/adminFailures";
import type { AdminFailure } from "../api/adminFailures";
import { ApiError } from "../api/errors";
import type {
  AdminReport,
  AdminReportStatusFilter,
  ReportStatus,
  ReportStats,
} from "../api/types";
import { AdminKeyGate } from "./AdminKeyGate";
import { AdminPanel } from "./AdminPanel";
import type { AppliedFilters } from "./AdminPanel";

type Phase = "locked" | "verifying" | "unlocked";

type RetryTarget =
  | { type: "list" }
  | { type: "stats" }
  | { type: "status"; reportId: number; status: ReportStatus };

interface PageParams {
  status: AdminReportStatusFilter;
  questionId: number | null;
  skip: number;
}

const ENTRY_INVALID_KEY_MESSAGE = "La clave no es válida.";
const UNEXPECTED_ERROR_MESSAGE = "Ocurrió un error inesperado.";
const STATUS_UPDATED_MESSAGE = "Estado actualizado.";

export function Admin() {
  const [phase, setPhase] = useState<Phase>("locked");
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [reports, setReports] = useState<readonly AdminReport[]>([]);
  const [filters, setFilters] = useState<AppliedFilters>({
    status: "pendiente",
    questionId: null,
  });
  const [skip, setSkip] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [patchingId, setPatchingId] = useState<number | null>(null);
  const [failure, setFailure] = useState<AdminFailure | null>(null);
  const [retry, setRetry] = useState<RetryTarget | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(
    new Set<number>(),
  );

  const sessionRef = useRef(0);
  const listRef = useRef(0);
  const statsRef = useRef(0);
  const patchingRef = useRef<number | null>(null);
  const filtersRef = useRef<AppliedFilters>({
    status: "pendiente",
    questionId: null,
  });
  const skipRef = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const busy = listLoading || statsLoading || patchingId !== null;

  useEffect(() => {
    if (phase === "unlocked") {
      headingRef.current?.focus();
    }
  }, [phase]);

  function resetSession() {
    sessionRef.current += 1;
    patchingRef.current = null;
    setApiKey(null);
    setStats(null);
    setReports([]);
    filtersRef.current = { status: "pendiente", questionId: null };
    skipRef.current = 0;
    setFilters({ status: "pendiente", questionId: null });
    setSkip(0);
    setListLoading(false);
    setStatsLoading(false);
    setPatchingId(null);
    setFailure(null);
    setRetry(null);
    setStatusMessage(null);
    setExpanded(new Set<number>());
  }

  function forceLock(session: number) {
    if (sessionRef.current !== session) return;
    resetSession();
    setGateError(ADMIN_EXPIRED_KEY_MESSAGE);
    setPhase("locked");
  }

  function failUnexpected() {
    setFailure({
      kind: "error",
      message: UNEXPECTED_ERROR_MESSAGE,
      retryable: false,
    });
    setRetry(null);
  }

  async function loadPage(
    key: string,
    params: PageParams,
    options: { clear: boolean },
  ) {
    const session = sessionRef.current;
    const generation = (listRef.current += 1);
    if (options.clear) {
      setReports([]);
    }
    setListLoading(true);
    try {
      const page = await getReports(key, {
        status: params.status,
        questionId: params.questionId,
        skip: params.skip,
        limit: ADMIN_REPORT_PAGE_SIZE,
      });
      if (sessionRef.current !== session || listRef.current !== generation) {
        return;
      }
      setReports(page);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      if (
        apiError !== null &&
        apiError.kind === "http" &&
        apiError.status === 401
      ) {
        forceLock(session);
        return;
      }
      if (sessionRef.current !== session || listRef.current !== generation) {
        return;
      }
      if (apiError === null) {
        failUnexpected();
        return;
      }
      console.error("No se pudieron cargar los reportes", {
        kind: apiError.kind,
        status: apiError.status,
      });
      setFailure(getAdminFailure(apiError));
      setRetry({ type: "list" });
    } finally {
      if (sessionRef.current === session && listRef.current === generation) {
        setListLoading(false);
      }
    }
  }

  async function loadStats(key: string) {
    const session = sessionRef.current;
    const generation = (statsRef.current += 1);
    setStatsLoading(true);
    try {
      const next = await getReportStats(key);
      if (sessionRef.current !== session || statsRef.current !== generation) {
        return;
      }
      setStats(next);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      if (
        apiError !== null &&
        apiError.kind === "http" &&
        apiError.status === 401
      ) {
        forceLock(session);
        return;
      }
      if (sessionRef.current !== session || statsRef.current !== generation) {
        return;
      }
      if (apiError === null) {
        failUnexpected();
        return;
      }
      console.error("No se pudieron cargar las estadísticas", {
        kind: apiError.kind,
        status: apiError.status,
      });
      setFailure(getAdminFailure(apiError));
      setRetry({ type: "stats" });
    } finally {
      if (sessionRef.current === session && statsRef.current === generation) {
        setStatsLoading(false);
      }
    }
  }

  async function handleEnterKey(value: string) {
    const session = (sessionRef.current += 1);
    setPhase("verifying");
    setGateError(null);
    try {
      const next = await getReportStats(value);
      if (sessionRef.current !== session) return;
      setApiKey(value);
      setStats(next);
      setPhase("unlocked");
      await loadPage(
        value,
        { status: "pendiente", questionId: null, skip: 0 },
        { clear: true },
      );
    } catch (error) {
      if (sessionRef.current !== session) return;
      setPhase("locked");
      if (!(error instanceof ApiError)) {
        setGateError(UNEXPECTED_ERROR_MESSAGE);
        return;
      }
      const mapped = getAdminFailure(error);
      setGateError(
        mapped.kind === "unauthorized"
          ? ENTRY_INVALID_KEY_MESSAGE
          : mapped.message,
      );
    }
  }

  function handleSignOut() {
    resetSession();
    setGateError(null);
    setPhase("locked");
  }

  function handleApplyFilters(
    status: AdminReportStatusFilter,
    questionId: number | null,
  ) {
    if (apiKey === null) return;
    filtersRef.current = { status, questionId };
    skipRef.current = 0;
    setFilters({ status, questionId });
    setSkip(0);
    setFailure(null);
    setRetry(null);
    setStatusMessage(null);
    void loadPage(apiKey, { status, questionId, skip: 0 }, { clear: true });
  }

  function handlePage(nextSkip: number) {
    if (apiKey === null) return;
    skipRef.current = nextSkip;
    setSkip(nextSkip);
    setFailure(null);
    setRetry(null);
    setStatusMessage(null);
    void loadPage(
      apiKey,
      {
        status: filtersRef.current.status,
        questionId: filtersRef.current.questionId,
        skip: nextSkip,
      },
      { clear: true },
    );
  }

  async function handleChangeStatus(reportId: number, status: ReportStatus) {
    if (apiKey === null || patchingRef.current !== null) return;
    const session = sessionRef.current;
    patchingRef.current = reportId;
    setPatchingId(reportId);
    setFailure(null);
    setRetry(null);
    setStatusMessage(null);
    try {
      await updateReportStatus(apiKey, reportId, status);
      if (sessionRef.current !== session) return;
      setStatusMessage(STATUS_UPDATED_MESSAGE);
      await loadPage(
        apiKey,
        {
          status: filtersRef.current.status,
          questionId: filtersRef.current.questionId,
          skip: skipRef.current,
        },
        { clear: false },
      );
      if (sessionRef.current !== session) return;
      await loadStats(apiKey);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      if (
        apiError !== null &&
        apiError.kind === "http" &&
        apiError.status === 401
      ) {
        forceLock(session);
        return;
      }
      if (sessionRef.current !== session) return;
      if (apiError === null) {
        failUnexpected();
        return;
      }
      console.error("No se pudo actualizar el reporte", {
        reportId,
        kind: apiError.kind,
        status: apiError.status,
      });
      const mapped = getAdminFailure(apiError);
      setFailure(mapped);
      if (apiError.kind === "http" && apiError.status === 404) {
        setRetry(null);
        await loadPage(
          apiKey,
          {
            status: filtersRef.current.status,
            questionId: filtersRef.current.questionId,
            skip: skipRef.current,
          },
          { clear: false },
        );
      } else if (mapped.retryable) {
        setRetry({ type: "status", reportId, status });
      } else {
        setRetry(null);
      }
    } finally {
      if (patchingRef.current === reportId) {
        patchingRef.current = null;
      }
      setPatchingId((current) => (current === reportId ? null : current));
    }
  }

  function handleRetry() {
    if (apiKey === null || retry === null) return;
    setFailure(null);
    setStatusMessage(null);
    if (retry.type === "list") {
      setRetry(null);
      void loadPage(
        apiKey,
        {
          status: filtersRef.current.status,
          questionId: filtersRef.current.questionId,
          skip: skipRef.current,
        },
        { clear: false },
      );
    } else if (retry.type === "stats") {
      setRetry(null);
      void loadStats(apiKey);
    } else {
      setRetry(null);
      void handleChangeStatus(retry.reportId, retry.status);
    }
  }

  function handleToggleQuestion(reportId: number) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(reportId)) {
        next.delete(reportId);
      } else {
        next.add(reportId);
      }
      return next;
    });
  }

  return (
    <section className="admin">
      <h1>Administración</h1>
      {apiKey === null ? (
        <AdminKeyGate
          verifying={phase === "verifying"}
          error={gateError}
          onSubmit={(value) => void handleEnterKey(value)}
        />
      ) : (
        <AdminPanel
          stats={stats}
          reports={reports}
          filters={filters}
          skip={skip}
          listLoading={listLoading}
          busy={busy}
          failure={failure}
          statusMessage={statusMessage}
          expandedIds={expanded}
          headingRef={headingRef}
          onApplyFilters={handleApplyFilters}
          onPage={handlePage}
          onChangeStatus={(reportId, status) =>
            void handleChangeStatus(reportId, status)
          }
          onRetry={handleRetry}
          onToggleQuestion={handleToggleQuestion}
          onSignOut={handleSignOut}
        />
      )}
    </section>
  );
}
