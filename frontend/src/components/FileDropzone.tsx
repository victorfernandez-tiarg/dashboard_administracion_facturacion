import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";
import clsx from "clsx";

interface FileDropzoneProps {
  onFile: (file: File) => void;
  accept?: string;
  label?: string;
  loading?: boolean;
}

export default function FileDropzone({ onFile, accept = ".xlsx,.xls", label = "Excel", loading }: FileDropzoneProps) {
  const onDrop = useCallback((files: File[]) => { if (files[0]) onFile(files[0]); }, [onFile]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"], "application/vnd.ms-excel": [".xls"] },
    multiple: false,
    disabled: loading,
  });

  return (
    <div
      {...getRootProps()}
      className={clsx(
        "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
        isDragActive ? "border-brand bg-brand/5" : "border-border hover:border-brand/50",
        loading && "opacity-50 cursor-not-allowed"
      )}
    >
      <input {...getInputProps()} />
      <Upload size={24} className="mx-auto mb-2 text-muted" />
      <p className="text-sm font-medium text-ink">{loading ? "Procesando..." : `Subir ${label}`}</p>
      <p className="text-xs text-muted mt-1">{isDragActive ? "Soltá el archivo aquí" : "Arrastrá o hacé clic para seleccionar"}</p>
    </div>
  );
}
