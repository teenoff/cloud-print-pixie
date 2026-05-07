/**
 * PDF utilities for extracting information from PDF files
 */

/**
 * Extract page count from a PDF file
 * @param file PDF file from input
 * @returns Promise resolving to page count
 */
export const getPDFPageCount = async (file: File): Promise<number> => {
  try {
    // Dynamically import pdfjs-dist
    const pdfjsLib = await import("pdfjs-dist");

    // Set up the worker
    const pdfjsWorker = await import("pdfjs-dist/build/pdf.worker.mjs");
    pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(
      new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url),
      { type: "module" }
    );

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return pdf.numPages;
  } catch (error) {
    console.error("Error extracting PDF page count:", error);
    throw new Error("Failed to read PDF file. Please ensure it's a valid PDF.");
  }
};

/**
 * Validate PDF file
 * @param file File to validate
 * @returns Object with isValid flag and error message if invalid
 */
export const validatePDFFile = (
  file: File
): { isValid: boolean; error?: string } => {
  // Check MIME type
  if (file.type !== "application/pdf") {
    return {
      isValid: false,
      error: "Please upload a PDF file",
    };
  }

  // Check file extension
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return {
      isValid: false,
      error: "File must have a .pdf extension",
    };
  }

  // Check file size (20MB max)
  const maxSize = 20 * 1024 * 1024; // 20MB in bytes
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `File is too large. Maximum size is 20MB, your file is ${(file.size / 1024 / 1024).toFixed(1)}MB`,
    };
  }

  return { isValid: true };
};
