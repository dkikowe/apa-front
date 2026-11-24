import { useEffect, useState } from "react";
import { Download, Eye, LoaderCircle } from "lucide-react";
import { getDocumentFile } from "../api";
import { Modal } from "./common";
import { Button } from "./ui/button";

function DocumentViewer({
  id,
  title,
  onClose,
}: {
  id: string;
  title: string;
  onClose: () => void;
}) {
  const [file, setFile] = useState<{
    url: string;
    mime: string;
    name: string;
  }>();
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void getDocumentFile(id, controller.signal)
      .then(({ blob, mime, name }) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setFile({ url: objectUrl, mime, name });
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  return (
    <Modal
      title={title}
      description="Құжатты көріңіз немесе құрылғыңызға жүктеп алыңыз."
      onClose={onClose}
      className="document-modal"
    >
      {error && (
        <p role="alert" className="field-error">
          {error} Терезені жауып, қайта ашып көріңіз.
        </p>
      )}
      {!file && !error && (
        <p role="status">
          <LoaderCircle className="spin" size={24} /> Құжат жүктелуде…
        </p>
      )}
      {file && (
        <>
          <div className="document-actions">
            <Button asChild>
              <a href={file.url} download={file.name}>
                <Download size={22} /> Жүктеп алу
              </a>
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Жабу
            </Button>
          </div>
          <p className="small-note">
            Құжат көрінбесе, «Жүктеп алу» батырмасын басыңыз.
          </p>
          <div className="document-preview">
            {file.mime === "application/pdf" ? (
              <iframe title={title} src={file.url} />
            ) : (
              <img
                alt={title}
                src={file.url}
                onError={() => setError("Суретті көрсету мүмкін болмады.")}
              />
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
export function DocumentButton({
  documentId,
  kind,
  compact = false,
}: {
  documentId: string;
  kind: "identity" | "receipt";
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const title = kind === "identity" ? "Жеке куәлік" : "Төлем чегі";
  return (
    <>
      <Button
        type="button"
        size={compact ? "sm" : "default"}
        variant="outline"
        onClick={() => setOpen(true)}
      >
        <Eye size={20} />{" "}
        {kind === "identity" ? "Куәлікті көрсету" : "Чекті көрсету"}
      </Button>
      {open && (
        <DocumentViewer
          key={documentId}
          id={documentId}
          title={title}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
