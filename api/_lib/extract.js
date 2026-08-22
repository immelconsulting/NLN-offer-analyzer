// Parser libraries are imported lazily inside the function: if either fails
// to load in the serverless environment, extraction returns null instead of
// crashing the whole endpoint at boot.

// Extracts plain text from an uploaded file sent as
// { name, type, data } where data is base64 (no data-URL prefix).
// Returns trimmed text or null if the file can't be read. Errors never
// throw out of here — context extras must not break an analysis.

const MAX_CHARS = 8000; // keep prompts bounded; resumes/JDs rarely exceed this
const MAX_BYTES = 3 * 1024 * 1024; // hard server-side cap (client caps at 2MB)

export async function extractTextFromUpload(file) {
  if (!file || typeof file.data !== "string" || !file.data) return null;
  try {
    const buf = Buffer.from(file.data, "base64");
    if (buf.length === 0 || buf.length > MAX_BYTES) return null;

    const name = (file.name || "").toLowerCase();
    const type = (file.type || "").toLowerCase();
    let text = null;

    if (type.includes("pdf") || name.endsWith(".pdf")) {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buf) });
      const result = await parser.getText();
      text = result?.text || null;
    } else if (
      type.includes("officedocument.wordprocessingml") ||
      name.endsWith(".docx")
    ) {
      const { default: mammoth } = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: buf });
      text = result?.value || null;
    } else if (type.startsWith("text/") || name.endsWith(".txt")) {
      text = buf.toString("utf-8");
    }

    if (!text) return null;
    const cleaned = text.replace(/\s+\n/g, "\n").trim();
    if (!cleaned) return null;
    return cleaned.length > MAX_CHARS
      ? `${cleaned.slice(0, MAX_CHARS)}\n[truncated]`
      : cleaned;
  } catch (err) {
    console.error("File text extraction failed:", err);
    return null;
  }
}
