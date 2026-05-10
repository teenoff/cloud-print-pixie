import { PDFDocument } from "pdf-lib";

export async function countPdfPages(file: File): Promise<number> {
  try {
    const buf = await file.arrayBuffer();
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false });
    return doc.getPageCount();
  } catch {
    return 0;
  }
}
