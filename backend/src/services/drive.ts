import { google } from "googleapis";
import { procesarFacturas } from "./etl/procesar";
import { procesarCC } from "./etl/procesar_cc";

interface SyncResult {
  archivos: string[];
  errores: string[];
}

export async function sincronizarDrive(): Promise<SyncResult> {
  const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON no configurado");

  const creds = JSON.parse(credJson);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  const drive = google.drive({ version: "v3", auth });

  const archivos: string[] = [];
  const errores: string[] = [];

  const descargar = async (fileId: string): Promise<Buffer> => {
    const response = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );
    return Buffer.from(response.data as ArrayBuffer);
  };

  const facturacionId = process.env.GOOGLE_DRIVE_FACTURACION_FILE_ID;
  if (facturacionId) {
    try {
      const buf = await descargar(facturacionId);
      await procesarFacturas(buf);
      archivos.push("datos_facturacion.xlsx");
    } catch (e: any) {
      errores.push(`Facturación: ${e.message}`);
    }
  }

  const ccId = process.env.GOOGLE_DRIVE_CC_FILE_ID;
  if (ccId) {
    try {
      const buf = await descargar(ccId);
      await procesarCC(buf);
      archivos.push("cc_clientes.xlsx");
    } catch (e: any) {
      errores.push(`CC: ${e.message}`);
    }
  }

  const compId = process.env.GOOGLE_DRIVE_COMPOSICION_FILE_ID;
  if (compId) {
    try {
      const buf = await descargar(compId);
      await procesarCC(buf, { isComposicion: true });
      archivos.push("composicion_saldos.xlsx");
    } catch (e: any) {
      errores.push(`Composición: ${e.message}`);
    }
  }

  return { archivos, errores };
}
