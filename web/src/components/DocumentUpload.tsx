import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Upload, FileCheck2, LoaderCircle } from "lucide-react";
import { missingDocumentFields } from "../../../shared/document-recognition";
import { DuplicateNotice } from "./DuplicateNotice";
import { api, send, queryClient, ApiError } from "../api";
import {
  documentPollingInterval,
  replaceDocumentStatus,
} from "../document-status";
import { DocumentButton } from "./DocumentButton";
import { Button } from "./ui/button";
export function DocumentUpload({
  kind,
  onFields,
  onDocument,
  onUploading,
  disabled = false,
  initialDocumentId = "",
  onBlocked,
}: {
  kind: "identity" | "receipt";
  onFields: (fields: any, fillBlanksOnly?: boolean) => void;
  onDocument: (id: string) => void;
  onUploading?: (uploading: boolean) => void;
  disabled?: boolean;
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
  const callbacks = useRef({ onFields, onDocument, onUploading, onBlocked });
  callbacks.current = { onFields, onDocument, onUploading, onBlocked };
  const [id, setId] = useState(initialDocumentId),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [uploadConflict, setUploadConflict] = useState<any>(null);
  const existingAttachment = !!id && id === originalAttachment.current;
  const jobKey = existingAttachment ? ["ocr", id, "attached"] : ["ocr", id];
  const job = useQuery({
    queryKey: jobKey,
    refetchOnMount: existingAttachment ? "always" : true,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => {
      if (existingAttachment && refreshed.current !== id) {
        const latest = await api(`/documents/${id}/refresh`, {
          method: "POST",
          body: "{}",
          signal,
        });
        if (!signal.aborted) refreshed.current = id;
        return latest;
      }
      return api(`/documents/${id}`, { signal });
    },
    enabled: !!id,
    refetchInterval: (q) =>
      documentPollingInterval(q.state.data, q.state.error),
  });
  const checkingAttachment = existingAttachment && !job.isFetchedAfterMount;
  useEffect(() => {
    if (
      uploading ||
      checkingAttachment ||
      job.isError ||
      job.data?.status !== "done"
    )
      return;
    const fields = job.data.fields || {};
    const stamp = JSON.stringify([id, fields]);
    if (applied.current === stamp) return;
    applied.current = stamp;
    callbacks.current.onFields(fields, id === originalAttachment.current);
  }, [id, job.data, checkingAttachment, job.isError, uploading]);
  const missingFields =
    job.data?.status === "done"
      ? missingDocumentFields(kind, job.data.fields || {})
      : [];
  const processing =
    !!id &&
    (checkingAttachment ||
      !["done", "failed", "duplicate"].includes(job.data?.status)) &&
    !job.isError;
  const conflict =
    uploadConflict ||
    (job.data?.status === "duplicate"
      ? job.data.duplicate || { message: job.data.error }
      : null);
  useEffect(() => {
    callbacks.current.onBlocked?.(!!conflict || job.isError);
  }, [conflict, job.isError]);
  const pending = uploading || processing;
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
        <p>
          {uploading
            ? "Құжат жүктелуде…"
            : processing
              ? kind === "identity"
                ? "Куәлік оқылуда. Оқылмаған деректер автоматты түрде қайта тексеріледі. Күте тұрыңыз…"
                : "Чек оқылуда. Оқылмаған деректер автоматты түрде қайта тексеріледі."
              : job.data?.status === "done"
                ? missingFields.length
                  ? `Оқылмаған деректер: ${missingFields.join(", ")}. ${kind === "identity" ? "Куәліктің екі жағы анық көрінетін файлды жүктеңіз." : "Чек анық көрінетін файлды жүктеңіз."}`
                  : "Құжат оқылды. Төмендегі мәліметтерді тексеріңіз."
                : job.data?.status === "failed" ||
                    job.data?.status === "duplicate"
                  ? job.data.error
                  : "PDF, JPG немесе PNG · 15 МБ-қа дейін"}
        </p>
        <input
          ref={input}
          type="file"
          hidden
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            e.target.value = "";
            if (file.size > 15 * 1024 * 1024) {
              setError("Файл 15 МБ-тан аспауы керек.");
              return;
            }
            setUploading(true);
            callbacks.current.onUploading?.(true);
            setError("");
            setUploadConflict(null);
            try {
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
              setId(result.id);
              callbacks.current.onDocument(result.id);
            } catch (e) {
              if (!active.current) return;
              setError((e as Error).message);
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
          disabled={disabled || uploading || !!processing}
          onClick={() => input.current?.click()}
        >
          {kind === "identity" ? "Жеке куәлікті жүктеу" : "Төлем чегін жүктеу"}
        </Button>
        {(job.data?.status === "failed" || job.data?.status === "done") &&
          (job.data?.attempts ?? 0) < 3 && (
            <Button
              type="button"
              variant="outline"
              disabled={disabled || pending}
              onClick={async () => {
                setUploading(true);
                setError("");
                try {
                  await send(`/documents/${id}/retry`, {});
                  await replaceDocumentStatus(queryClient, jobKey, {
                    ...job.data,
                    status: "queued",
                  });
                  applied.current = "";
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setUploading(false);
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
                onClick={() => {
                  const existingId = conflict.duplicateDocumentId;
                  originalAttachment.current = "";
                  applied.current = "";
                  setUploadConflict(null);
                  setError("");
                  setId(existingId);
                  callbacks.current.onDocument(existingId);
                  void queryClient.invalidateQueries({
                    queryKey: ["ocr", existingId],
                  });
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
        {(error || job.isError) && (
          <p role="alert" className="field-error">
            {error || "Құжаттың күйін тексеру мүмкін болмады."}
          </p>
        )}
      </div>
    </div>
  );
}
