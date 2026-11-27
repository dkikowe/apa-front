import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Upload, FileCheck2, LoaderCircle } from "lucide-react";
import { missingDocumentFields } from "../../../shared/document-recognition";
import { DuplicateNotice } from "./DuplicateNotice";
import { api, send, queryClient, ApiError } from "../api";
import {
  documentPollingInterval,
  failedAttachmentBlocksSave,
  replaceDocumentStatus,
  readDocumentStatus,
  statusAccessError,
  type PreviousAttachment,
} from "../document-status";
import { DocumentButton } from "./DocumentButton";
import { Button } from "./ui/button";
export function DocumentUpload({
  kind,
  onFields,
  onDocument,
  onUploading,
  disabled = false,
  allowSavedEdits = false,
  replacingRecognizedText = false,
  initialDocumentId = "",
  onBlocked,
}: {
  kind: "identity" | "receipt";
  onFields: (fields: any, fillBlanksOnly?: boolean) => void;
  onDocument: (id: string, previous?: PreviousAttachment) => void;
  onUploading?: (uploading: boolean) => void;
  disabled?: boolean;
  allowSavedEdits?: boolean;
  replacingRecognizedText?: boolean;
  initialDocumentId?: string;
  onBlocked?: (blocked: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const originalAttachment = useRef(initialDocumentId);
  const refreshed = useRef("");
  const applied = useRef("");
  const lastApplied = useRef<PreviousAttachment | undefined>(undefined);
  const callbacks = useRef({ onFields, onDocument, onUploading, onBlocked });
  callbacks.current = { onFields, onDocument, onUploading, onBlocked };
  const [id, setId] = useState(initialDocumentId),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [rejectedReplacement, setRejectedReplacement] = useState(false),
    [uploadConflict, setUploadConflict] = useState<any>(null);
  const replacedRecognizedDocument = useRef(false);
  const existingAttachment = !!id && id === originalAttachment.current;
  const jobKey = existingAttachment ? ["ocr", id, "attached"] : ["ocr", id];
  const job = useQuery({
    queryKey: jobKey,
    refetchOnMount: existingAttachment ? "always" : true,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => {
      const refresh = existingAttachment && refreshed.current !== id;
      const latest = await readDocumentStatus(id, refresh, signal);
      if (refresh && !signal.aborted) refreshed.current = id;
      return latest;
    },
    enabled: !!id,
    refetchInterval: (q) =>
      documentPollingInterval(q.state.data, q.state.error),
  });
  const checkingAttachment =
    existingAttachment &&
    (!job.isFetchedAfterMount || refreshed.current !== id);
  const accessError = statusAccessError(job.error) ? job.error : null;
  const reconnecting =
    !!id && !accessError && (job.isError || job.fetchStatus === "paused");
  const current = checkingAttachment || job.isError ? undefined : job.data;
  const processing =
    !!id &&
    !accessError &&
    (reconnecting ||
      !["done", "failed", "duplicate"].includes(current?.status));
  useEffect(() => {
    if (uploading || !current) return;
    // The stored fields of a previous reader may still be present at the start
    // of a new cycle. Publish only results explicitly confirmed for this run.
    // A saved attachment keeps its original form values during background OCR.
    const checkpoint =
      !existingAttachment &&
      current.recoveryHasCheckpoint === true &&
      ["queued", "processing"].includes(current.status);
    if (current.status !== "done" && !checkpoint) return;
    const fields = current.fields || {};
    const stamp = JSON.stringify([id, fields]);
    if (applied.current === stamp) return;
    applied.current = stamp;
    lastApplied.current = { id, fields };
    callbacks.current.onFields(fields, existingAttachment);
  }, [id, current, existingAttachment, uploading]);
  const missingFields =
    current?.status === "done"
      ? missingDocumentFields(kind, current.fields || {})
      : [];
  const conflict =
    uploadConflict ||
    (!checkingAttachment && job.data?.status === "duplicate"
      ? job.data.duplicate || { message: job.data.error }
      : null);
  const blocked =
    !!conflict ||
    !!accessError ||
    rejectedReplacement ||
    failedAttachmentBlocksSave(
      current,
      id === initialDocumentId,
      replacedRecognizedDocument.current,
    );
  useEffect(() => {
    callbacks.current.onBlocked?.(blocked);
  }, [blocked]);
  function selectDocument(
    nextId: string,
    originalFields?: Record<string, string | number>,
  ) {
    const replacing = !!id && nextId !== id;
    if (nextId !== id && replacingRecognizedText)
      replacedRecognizedDocument.current = true;
    let previous: PreviousAttachment | undefined;
    if (replacing) {
      const recognized = lastApplied.current?.id === id;
      if (id === initialDocumentId || recognized)
        replacedRecognizedDocument.current = true;
      previous = recognized
        ? lastApplied.current
        : { id, fields: id === initialDocumentId ? originalFields || {} : {} };
      lastApplied.current = undefined;
    }
    setId(nextId);
    callbacks.current.onDocument(nextId, previous);
  }
  // Existing attachments use only final reads, so other profile/payment edits
  // can be saved while the worker is checking their original.
  const pending =
    uploading || (processing && !(existingAttachment && allowSavedEdits));
  useEffect(() => {
    callbacks.current.onUploading?.(pending);
    return () => callbacks.current.onUploading?.(false);
  }, [pending]);
  return (
    <div className="upload-box">
      <div className="upload-symbol">
        {uploading || processing ? (
          <LoaderCircle className="spin" size={25} />
        ) : id ? (
          <FileCheck2 size={25} />
        ) : (
          <Upload size={25} />
        )}
      </div>
      <div>
        <strong>
          {kind === "identity"
            ? "Куәліктен автоматты толтыру"
            : "Чектен автоматты толтыру"}
        </strong>
        <p role="status">
          {uploading
            ? "Құжат жүктелуде…"
            : reconnecting
              ? "Байланыс уақытша үзілді. Құжаттың күйі қайта тексеріледі…"
              : processing
                ? kind === "identity"
                  ? "Куәлік оқылуда. Оқылмаған деректер қайта тексеріледі…"
                  : "Чек оқылуда. Оқылмаған деректер қайта тексеріледі…"
                : current?.status === "done"
                  ? missingFields.length
                    ? "Құжаттан оқылған деректер төменде көрсетілді."
                    : "Құжат оқылды. Төмендегі мәліметтерді тексеріңіз."
                  : current?.status === "failed" ||
                      current?.status === "duplicate"
                    ? current.error
                    : "PDF, JPG немесе PNG · 15 МБ-қа дейін"}
        </p>
        <input
          ref={input}
          type="file"
          disabled={disabled || uploading}
          hidden
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file || disabled || uploading) return;
            e.target.value = "";
            if (file.size > 15 * 1024 * 1024) {
              setError("Файл 15 МБ-тан аспауы керек.");
              setRejectedReplacement(!!id);
              return;
            }
            setUploading(true);
            callbacks.current.onUploading?.(true);
            setError("");
            setRejectedReplacement(false);
            setUploadConflict(null);
            try {
              let originalFields = current?.fields;
              if (
                existingAttachment &&
                lastApplied.current?.id !== id &&
                !originalFields
              ) {
                const original = await readDocumentStatus(id);
                if (!active.current) return;
                originalFields = original.fields;
              }
              const body = new FormData();
              body.append("kind", kind);
              body.append("file", file);
              const result = await api("/documents", { method: "POST", body });
              if (!active.current) return;
              // A cancelled form can reuse the same ID. Replace stale cached
              // duplicate/queued results and apply the returned fields again.
              originalAttachment.current = "";
              applied.current = "";
              await replaceDocumentStatus(queryClient, ["ocr", result.id], {
                ...result,
                _id: result.id,
              });
              if (!active.current) return;
              selectDocument(result.id, originalFields);
            } catch (e) {
              if (!active.current) return;
              setError((e as Error).message);
              setRejectedReplacement(!!id);
              if (e instanceof ApiError && e.status === 409)
                setUploadConflict(e.details);
            } finally {
              if (active.current) setUploading(false);
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || uploading}
          onClick={() => input.current?.click()}
        >
          {kind === "identity" ? "Жеке куәлікті жүктеу" : "Төлем чегін жүктеу"}
        </Button>
        {(current?.status === "failed" || current?.status === "done") &&
          !current.wrongDocumentKind &&
          !current.permanentReadFailure &&
          !conflict && (
            <Button
              type="button"
              variant="outline"
              disabled={disabled || uploading}
              onClick={async () => {
                setUploading(true);
                callbacks.current.onUploading?.(true);
                setError("");
                try {
                  await send(`/documents/${id}/retry`, {});
                  if (!active.current) return;
                  await replaceDocumentStatus(queryClient, jobKey, {
                    ...current,
                    status: "queued",
                    recoveryHasCheckpoint: false,
                    nextReadAt: null,
                  });
                  applied.current = "";
                } catch (e) {
                  if (active.current) setError((e as Error).message);
                } finally {
                  if (active.current) setUploading(false);
                }
              }}
            >
              Қайта оқу
            </Button>
          )}
        {conflict && (
          <>
            <DuplicateNotice details={conflict} />
            {conflict.canReuse && conflict.duplicateDocumentId && (
              <Button
                type="button"
                variant="outline"
                disabled={disabled || uploading}
                onClick={async () => {
                  const existingId = conflict.duplicateDocumentId;
                  setUploading(true);
                  callbacks.current.onUploading?.(true);
                  try {
                    const latest = await readDocumentStatus(existingId);
                    if (!active.current) return;
                    await replaceDocumentStatus(
                      queryClient,
                      ["ocr", existingId],
                      latest,
                    );
                    if (!active.current) return;
                    originalAttachment.current = "";
                    applied.current = "";
                    setUploadConflict(null);
                    setRejectedReplacement(false);
                    setError("");
                    selectDocument(existingId);
                  } catch (e) {
                    if (active.current) setError((e as Error).message);
                  } finally {
                    if (active.current) setUploading(false);
                  }
                }}
              >
                Бұрын жүктелген құжатты пайдалану
              </Button>
            )}
          </>
        )}
        {id && (
          <div className="uploaded-document-action">
            <DocumentButton documentId={id} kind={kind} compact />
          </div>
        )}
        {(error || accessError) && (
          <p role="alert" className="field-error">
            {error || accessError?.message}
          </p>
        )}
      </div>
    </div>
  );
}
