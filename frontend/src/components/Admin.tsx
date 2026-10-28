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
  getQuestionEditFailure,
} from "../api/adminFailures";
import type { AdminFailure } from "../api/adminFailures";
import { ApiError } from "../api/errors";
import {
  getQuestion,
  getQuestionEdits,
  hideQuestion,
  updateQuestion,
} from "../api/questionEditing";
import type {
  AdminQuestion,
  AdminQuestionEdit,
  AdminQuestionPatch,
  AdminReport,
  AdminReportStatusFilter,
  ReportStatus,
  ReportStats,
} from "../api/types";
import { AdminKeyGate } from "./AdminKeyGate";
import { AdminPanel } from "./AdminPanel";
import type { AppliedFilters } from "./AdminPanel";
import { AdminQuestionEditor } from "./AdminQuestionEditor";
import { changedFieldLabels } from "./questionEditorForm";

type Phase = "locked" | "verifying" | "unlocked";

type RetryTarget =
  | { type: "list" }
  | { type: "stats" }
  | { type: "status"; reportId: number; status: ReportStatus }
  | { type: "editorOpen"; questionId: number };

type EditorRetry =
  | { type: "save"; questionId: number; patch: AdminQuestionPatch }
  | { type: "hide"; questionId: number }
  | { type: "restore"; questionId: number };

type EditorState =
  | { phase: "closed" }
  | { phase: "loading"; questionId: number }
  | { phase: "ready"; questionId: number; question: AdminQuestion };

interface PageParams {
  status: AdminReportStatusFilter;
  questionId: number | null;
  skip: number;
}

const ENTRY_INVALID_KEY_MESSAGE = "La clave no es válida.";
const UNEXPECTED_ERROR_MESSAGE = "Ocurrió un error inesperado.";
const STATUS_UPDATED_MESSAGE = "Estado actualizado.";
const EDITOR_NO_CHANGES_MESSAGE = "No hay cambios para guardar.";
const EDITOR_NOTHING_SAVED_MESSAGE = "No se guardó ningún cambio.";
const EDITOR_HIDDEN_MESSAGE = "Pregunta oculta.";
const EDITOR_RESTORED_MESSAGE = "Pregunta visible de nuevo.";

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
  const [editor, setEditor] = useState<EditorState>({ phase: "closed" });
  const [editorBusy, setEditorBusy] = useState(false);
  const [editorFailure, setEditorFailure] = useState<AdminFailure | null>(null);
  const [editorRetry, setEditorRetry] = useState<EditorRetry | null>(null);
  const [editorStatus, setEditorStatus] = useState<string | null>(null);
  const [showReminder, setShowReminder] = useState(false);
  const [edits, setEdits] = useState<readonly AdminQuestionEdit[] | null>(null);
  const [editsLoading, setEditsLoading] = useState(false);
  const [editsFailure, setEditsFailure] = useState<AdminFailure | null>(null);

  const sessionRef = useRef(0);
  const listRef = useRef(0);
  const statsRef = useRef(0);
  const patchingRef = useRef<number | null>(null);
  const editorRef = useRef(0);
  const editsRef = useRef(0);
  const editorIdRef = useRef<number | null>(null);
  const writeTokenRef = useRef(0);
  const writeInFlightRef = useRef<number | null>(null);
  const editorHeadingRef = useRef<HTMLHeadingElement>(null);
  const historyHeadingRef = useRef<HTMLHeadingElement>(null);
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

  function closeEditor() {
    editorRef.current += 1;
    editorIdRef.current = null;
    writeInFlightRef.current = null;
    setEditorBusy(false);
    setEditor({ phase: "closed" });
    setEditorFailure(null);
    setEditorRetry(null);
    setEditorStatus(null);
    setShowReminder(false);
    setEdits(null);
    setEditsLoading(false);
    setEditsFailure(null);
  }

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
    closeEditor();
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
    } else if (retry.type === "editorOpen") {
      setRetry(null);
      handleOpenEditor(retry.questionId);
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

  function isEditorStale(
    session: number,
    generation: number,
    questionId: number,
  ): boolean {
    return (
      sessionRef.current !== session ||
      editorRef.current !== generation ||
      editorIdRef.current !== questionId
    );
  }

  async function loadEdits(
    generation: number,
    questionId: number,
  ): Promise<boolean> {
    if (apiKey === null) return false;
    const session = sessionRef.current;
    const editsGeneration = (editsRef.current += 1);
    setEditsLoading(true);
    setEditsFailure(null);
    try {
      const entries = await getQuestionEdits(apiKey, questionId);
      if (
        isEditorStale(session, generation, questionId) ||
        editsRef.current !== editsGeneration
      ) {
        return false;
      }
      setEdits(entries);
      setEditsFailure(null);
      setEditsLoading(false);
      return true;
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      if (
        apiError !== null &&
        apiError.kind === "http" &&
        apiError.status === 401
      ) {
        forceLock(session);
        return false;
      }
      if (
        isEditorStale(session, generation, questionId) ||
        editsRef.current !== editsGeneration
      ) {
        return false;
      }
      if (apiError === null) {
        setEditsFailure({
          kind: "error",
          message: UNEXPECTED_ERROR_MESSAGE,
          retryable: false,
        });
        setEdits(null);
        setEditsLoading(false);
        return false;
      }
      console.error("No se pudo cargar el historial de la pregunta", {
        questionId,
        kind: apiError.kind,
        status: apiError.status,
      });
      setEditsFailure(getQuestionEditFailure(apiError));
      setEdits(null);
      setEditsLoading(false);
      return false;
    }
  }

  async function loadQuestion(generation: number, questionId: number) {
    if (apiKey === null) return;
    const session = sessionRef.current;
    try {
      const loaded = await getQuestion(apiKey, questionId);
      if (isEditorStale(session, generation, questionId)) return;
      setEditor({ phase: "ready", questionId, question: loaded });
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
      if (isEditorStale(session, generation, questionId)) return;
      if (apiError === null) {
        closeEditor();
        setFailure({
          kind: "error",
          message: UNEXPECTED_ERROR_MESSAGE,
          retryable: false,
        });
        setRetry(null);
        return;
      }
      console.error("No se pudo abrir la pregunta", {
        questionId,
        kind: apiError.kind,
        status: apiError.status,
      });
      const mapped = getQuestionEditFailure(apiError);
      closeEditor();
      setFailure(mapped);
      setRetry(mapped.retryable ? { type: "editorOpen", questionId } : null);
    }
  }

  function handleOpenEditor(questionId: number) {
    if (apiKey === null) return;
    if (
      (editor.phase === "loading" || editor.phase === "ready") &&
      editor.questionId === questionId
    ) {
      if (editor.phase === "ready") {
        editorHeadingRef.current?.focus();
      }
      return;
    }
    const generation = (editorRef.current += 1);
    editorIdRef.current = questionId;
    writeInFlightRef.current = null;
    setEditorBusy(false);
    setEditor({ phase: "loading", questionId });
    setEditorFailure(null);
    setEditorRetry(null);
    setEditorStatus(null);
    setShowReminder(false);
    setEdits(null);
    setEditsFailure(null);
    void loadQuestion(generation, questionId);
    void loadEdits(generation, questionId);
  }

  function handleCloseEditor() {
    closeEditor();
    headingRef.current?.focus();
  }

  function refreshAfterWrite(
    key: string,
    generation: number,
    questionId: number,
  ) {
    void loadEdits(generation, questionId);
    void loadPage(
      key,
      {
        status: filtersRef.current.status,
        questionId: filtersRef.current.questionId,
        skip: skipRef.current,
      },
      { clear: false },
    );
  }

  function failEditorWrite(
    error: unknown,
    session: number,
    generation: number,
    questionId: number,
    retry: EditorRetry,
    logMessage: string,
  ) {
    const apiError = error instanceof ApiError ? error : null;
    if (
      apiError !== null &&
      apiError.kind === "http" &&
      apiError.status === 401
    ) {
      forceLock(session);
      return;
    }
    if (isEditorStale(session, generation, questionId)) return;
    if (apiError === null) {
      setEditorFailure({
        kind: "error",
        message: UNEXPECTED_ERROR_MESSAGE,
        retryable: false,
      });
      setEditorRetry(null);
      return;
    }
    console.error(logMessage, {
      questionId,
      kind: apiError.kind,
      status: apiError.status,
    });
    const mapped = getQuestionEditFailure(apiError);
    if (apiError.kind === "http" && apiError.status === 404) {
      closeEditor();
      setFailure(mapped);
      setRetry(null);
      headingRef.current?.focus();
      return;
    }
    setEditorFailure(mapped);
    setEditorRetry(mapped.retryable ? retry : null);
  }

  async function handleSave(patch: AdminQuestionPatch | null) {
    if (apiKey === null || editor.phase !== "ready") return;
    if (writeInFlightRef.current !== null) return;
    const { questionId } = editor;
    setEditorFailure(null);
    setEditorRetry(null);
    setShowReminder(false);
    if (patch === null) {
      setEditorStatus(EDITOR_NO_CHANGES_MESSAGE);
      return;
    }
    const session = sessionRef.current;
    const generation = editorRef.current;
    const token = (writeTokenRef.current += 1);
    writeInFlightRef.current = token;
    setEditorBusy(true);
    setEditorStatus(null);
    try {
      const result = await updateQuestion(apiKey, questionId, patch);
      if (isEditorStale(session, generation, questionId)) return;
      setEditor({ phase: "ready", questionId, question: result.question });
      if (result.changed_fields.length === 0) {
        setEditorStatus(EDITOR_NOTHING_SAVED_MESSAGE);
        setShowReminder(false);
      } else {
        setEditorStatus(
          `Campos guardados: ${changedFieldLabels(result.changed_fields)}.`,
        );
        setShowReminder(true);
      }
      refreshAfterWrite(apiKey, generation, questionId);
    } catch (error) {
      failEditorWrite(
        error,
        session,
        generation,
        questionId,
        {
          type: "save",
          questionId,
          patch,
        },
        "No se pudo guardar la pregunta",
      );
    } finally {
      if (writeInFlightRef.current === token) {
        writeInFlightRef.current = null;
        setEditorBusy(false);
      }
    }
  }

  async function handleHide() {
    if (apiKey === null || editor.phase !== "ready") return;
    if (writeInFlightRef.current !== null) return;
    const { questionId, question } = editor;
    setEditorFailure(null);
    setEditorRetry(null);
    setShowReminder(false);
    const session = sessionRef.current;
    const generation = editorRef.current;
    const token = (writeTokenRef.current += 1);
    writeInFlightRef.current = token;
    setEditorBusy(true);
    setEditorStatus(null);
    try {
      await hideQuestion(apiKey, questionId);
      if (isEditorStale(session, generation, questionId)) return;
      setEditor({
        phase: "ready",
        questionId,
        question: { ...question, is_active: false },
      });
      setEditorStatus(EDITOR_HIDDEN_MESSAGE);
      setShowReminder(true);
      editorHeadingRef.current?.focus();
      refreshAfterWrite(apiKey, generation, questionId);
    } catch (error) {
      failEditorWrite(
        error,
        session,
        generation,
        questionId,
        {
          type: "hide",
          questionId,
        },
        "No se pudo ocultar la pregunta",
      );
    } finally {
      if (writeInFlightRef.current === token) {
        writeInFlightRef.current = null;
        setEditorBusy(false);
      }
    }
  }

  async function handleRestore() {
    if (apiKey === null || editor.phase !== "ready") return;
    if (writeInFlightRef.current !== null) return;
    const { questionId } = editor;
    setEditorFailure(null);
    setEditorRetry(null);
    setShowReminder(false);
    const session = sessionRef.current;
    const generation = editorRef.current;
    const token = (writeTokenRef.current += 1);
    writeInFlightRef.current = token;
    setEditorBusy(true);
    setEditorStatus(null);
    try {
      const result = await updateQuestion(apiKey, questionId, {
        is_active: true,
      });
      if (isEditorStale(session, generation, questionId)) return;
      setEditor({ phase: "ready", questionId, question: result.question });
      setEditorStatus(EDITOR_RESTORED_MESSAGE);
      setShowReminder(true);
      editorHeadingRef.current?.focus();
      refreshAfterWrite(apiKey, generation, questionId);
    } catch (error) {
      failEditorWrite(
        error,
        session,
        generation,
        questionId,
        {
          type: "restore",
          questionId,
        },
        "No se pudo volver a mostrar la pregunta",
      );
    } finally {
      if (writeInFlightRef.current === token) {
        writeInFlightRef.current = null;
        setEditorBusy(false);
      }
    }
  }

  function handleRetryEdits() {
    if (apiKey === null || editor.phase !== "ready") return;
    setEditsFailure(null);
    void loadEdits(editorRef.current, editor.questionId).then((applied) => {
      if (applied) {
        historyHeadingRef.current?.focus();
      }
    });
  }

  function handleEditorRetry() {
    if (editorRetry === null) return;
    const retry = editorRetry;
    setEditorFailure(null);
    setEditorRetry(null);
    if (retry.type === "save") {
      void handleSave(retry.patch);
    } else if (retry.type === "hide") {
      void handleHide();
    } else {
      void handleRestore();
    }
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
        <>
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
            onEditQuestion={handleOpenEditor}
            onSignOut={handleSignOut}
          />
          {editor.phase !== "closed" ? (
            <AdminQuestionEditor
              key={editor.questionId}
              questionId={editor.questionId}
              state={editor.phase}
              question={editor.phase === "ready" ? editor.question : null}
              edits={edits}
              editsLoading={editsLoading}
              editsFailure={editsFailure}
              busy={editorBusy}
              failure={editorFailure}
              statusMessage={editorStatus}
              showReminder={showReminder}
              headingRef={editorHeadingRef}
              historyHeadingRef={historyHeadingRef}
              onSave={(patch) => void handleSave(patch)}
              onHide={() => void handleHide()}
              onRestore={() => void handleRestore()}
              onClose={handleCloseEditor}
              onRetry={handleEditorRetry}
              onRetryEdits={handleRetryEdits}
            />
          ) : null}
        </>
      )}
    </section>
  );
}
