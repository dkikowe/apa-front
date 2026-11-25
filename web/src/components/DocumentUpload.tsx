import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Upload, FileCheck2, LoaderCircle } from "lucide-react";
import { missingDocumentFields } from "../../../shared/document-recognition";
import { DuplicateNotice } from "./DuplicateNotice";
import { api, send, queryClient, ApiError } from "../api";
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
  onFields: (fields: any) => void;
  onDocument: (id: string) => void;
  onUploading?: (uploading: boolean) => void;
  disabled?: boolean;
  initialDocumentId?: string;
  onBlocked?: (blocked: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const applied = useRef(initialDocumentId);
  const callbacks = useRef({ onFields, onDocument, onUploading, onBlocked });
  callbacks.current = { onFields, onDocument, onUploading, onBlocked };
  const [id, setId] = useState(initialDocumentId),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [uploadConflict, setUploadConflict] = useState<any>(null);
  const job = useQuery({
    queryKey: ["ocr", id],
    queryFn: () => api(`/documents/${id}`),
    enabled: !!id,
    refetchInterval: (q) =>
      ["done", "failed", "duplicate"].includes(q.state.data?.status)
        ? false
        : 1500,
  });
  useEffect(() => {
    if (job.data?.status === "done" && applied.current !== id) {
      applied.current = id;
      callbacks.current.onFields(job.data.fields || {});
    }
  }, [id, job.data]);
  const missingFields =
    job.data?.status === "done"
      ? missingDocumentFields(kind, job.data.fields || {})
      : [];
  const processing =
    !!id &&
    !["done", "failed", "duplicate"].includes(job.data?.status) &&
    !job.isError;
  const conflict =
    uploadConflict ||
    (job.data?.status === "duplicate"
      ? job.data.duplicate || { message: job.data.error }
      : null);
  useEffect(() => {
    callbacks.current.onBlocked?.(!!conflict);
  }, [conflict]);
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
              ? "Құжат оқылуда. Әзірге қолмен толтыра беруге болады."
              : job.data?.status === "done"
                ? missingFields.length
                  ? `${kind === "identity" ? "Куәлік толық оқылмады" : "Чек толық оқылмады"}. Табылмады: ${missingFields.join(", ")}. Қайта оқытыңыз немесе қолмен толтырыңыз.`
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
              setId(result.id);
              callbacks.current.onDocument(result.id);
            } catch (e) {
              setError((e as Error).message);
              if (e instanceof ApiError && e.status === 409)
                setUploadConflict(e.details);
            } finally {
              setUploading(false);
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
        {(job.data?.status === "failed" ||
          (job.data?.status === "done" && missingFields.length > 0)) &&
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
                  queryClient.setQueryData(["ocr", id], {
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
                  applied.current = "";
                  setUploadConflict(null);
                  setError("");
                  setId(existingId);
                  callbacks.current.onDocument(existingId);
                  const cached = queryClient.getQueryData<any>([
                    "ocr",
                    existingId,
                  ]);
                  if (cached?.status === "done") {
                    applied.current = existingId;
                    callbacks.current.onFields(cached.fields || {});
                  }
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
