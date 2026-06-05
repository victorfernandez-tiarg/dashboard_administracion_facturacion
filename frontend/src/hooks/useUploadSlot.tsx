import { createContext, useContext, useState, useEffect, useCallback } from "react";

interface UploaderConfig {
  onFile: (f: File) => void;
  label: string;
  loading: boolean;
}

interface UploadSlotCtx {
  config: UploaderConfig | null;
  register: (cfg: UploaderConfig | null) => void;
}

const UploadSlotContext = createContext<UploadSlotCtx>({
  config: null,
  register: () => {},
});

export function UploadSlotProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<UploaderConfig | null>(null);
  const register = useCallback((cfg: UploaderConfig | null) => setConfig(cfg), []);
  return (
    <UploadSlotContext.Provider value={{ config, register }}>
      {children}
    </UploadSlotContext.Provider>
  );
}

export function useUploadSlot() {
  return useContext(UploadSlotContext);
}

/** Llamar en cada página para registrar su uploader en el sidebar */
export function useRegisterUploader(
  onFile: (f: File) => void,
  label: string,
  loading: boolean
) {
  const { register } = useUploadSlot();
  useEffect(() => {
    register({ onFile, label, loading });
  }, [onFile, label, loading]);
  useEffect(() => {
    return () => register(null);
  }, []);
}
