import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Upload, FileCheck2, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "../api";
import { Button } from "./ui/button";
export function DocumentUpload({
  kind,
  onFields,
  onDocument,
  onUploading,
}: {
  kind: "identity" | "receipt";
  onFields: (fields: any) => void;
  onDocument: (id: string) => void;
  onUploading?: (uploading: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const applied = useRef("");
  const callbacks = useRef({ onFields, onDocument, onUploading });
  callbacks.current = { onFields, onDocument, onUploading };
  const [id, setId] = useState(""),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  const job = useQuery({
    queryKey: ["ocr", id],
    queryFn: () => api(`/documents/${id}`),
    enabled: !!id,
    refetchInterval: (q) =>
      q.state.data?.status === "done" || q.state.data?.status === "failed"
        ? false
        : 1500,
  });
  useEffect(() => {
    if (job.data?.status === "done" && applied.current !== id) {
      applied.current = id;
      callbacks.current.onFields(job.data.fields || {});
    }
  }, [id, job.data]);
  const processing = id && !["done", "failed"].includes(job.data?.status);
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
                ? Object.keys(job.data.fields || {}).length
                  ? "Құжат оқылды. Төмендегі мәліметтерді тексеріңіз."
                  : "Мәліметтер табылмады. Төмендегі жолдарды қолмен толтырыңыз."
                : job.data?.status === "failed"
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
            try {
              const body = new FormData();
              body.append("kind", kind);
              body.append("file", file);
              const result = await api("/documents", { method: "POST", body });
              setId(result.id);
              callbacks.current.onDocument(result.id);
              if (result.duplicate)
                toast.warning(
                  "Бұл файл бұрын жүктелген. Қайталап тіркемес бұрын тексеріңіз.",
                );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setUploading(false);
              callbacks.current.onUploading?.(false);
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={uploading || !!processing}
          onClick={() => input.current?.click()}
        >
          {kind === "identity" ? "Жеке куәлікті жүктеу" : "Төлем чегін жүктеу"}
        </Button>
        {(error || job.isError) && (
          <p role="alert" className="field-error">
            {error || "Құжаттың күйін тексеру мүмкін болмады."} Қолмен толтыра
            аласыз.
          </p>
        )}
      </div>
    </div>
  );
}
