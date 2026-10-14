/**
 * Pure TypeScript PDF 1.4 Generator & PDF Joiner/Merger Utility
 * Generates valid, multi-page binary .pdf files (application/pdf) with typography,
 * headings, bullet points, code blocks, headers/footers, and multi-document joining.
 */

export interface PdfDocumentInput {
  title: string;
  subtitle?: string;
  author?: string;
  date?: string;
  filename?: string;
  content: string;
}

/** Sanitize text for standard PDF Type1 fonts (WinAnsiEncoding safe) */
function sanitizePdfText(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/…/g, "...")
    .replace(/•/g, "-")
    .replace(/✓|✔/g, "[x]")
    .replace(/[^\x20-\x7E\n]/g, "");
}

/** Escape parentheses and backslashes in PDF literal strings */
function escapePdfLiteral(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

/** Word-wrap a single line of text to fit within maxChars */
function wrapLine(text: string, maxChars: number): string[] {
  const clean = text.trimEnd();
  if (!clean) return [""];
  if (clean.length <= maxChars) return [clean];

  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      if (word.length > maxChars) {
        for (let i = 0; i < word.length; i += maxChars) {
          lines.push(word.slice(i, i + maxChars));
        }
      } else {
        current = word;
      }
    } else if (current.length + 1 + word.length <= maxChars) {
      current += " " + word;
    } else {
      lines.push(current);
      if (word.length > maxChars) {
        for (let i = 0; i < word.length; i += maxChars) {
          const chunk = word.slice(i, i + maxChars);
          if (chunk.length === maxChars) {
            lines.push(chunk);
          } else {
            current = chunk;
          }
        }
      } else {
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

type StyledLine = {
  text: string;
  font: "F1" | "F2" | "F3"; // F1=Helvetica, F2=Helvetica-Bold, F3=Courier
  size: number;
  indent: number;
  spacingBefore: number;
  spacingAfter: number;
  color?: [number, number, number]; // RGB 0..1
  isRule?: boolean;
  isPageBreak?: boolean;
};

/** Parse markdown-like content into structured styled lines for PDF layout */
function parseContentToStyledLines(doc: PdfDocumentInput): StyledLine[] {
  const lines: StyledLine[] = [];
  const rawContent = sanitizePdfText(doc.content || "");
  const rawLines = rawContent.split("\n");

  let inCodeBlock = false;

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();

    if (trimmed.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      lines.push({
        text: "",
        font: "F1",
        size: 6,
        indent: 0,
        spacingBefore: 2,
        spacingAfter: 2,
      });
      continue;
    }

    if (inCodeBlock) {
      const wrapped = wrapLine(rawLine, 78);
      for (const w of wrapped) {
        lines.push({
          text: w,
          font: "F3",
          size: 9.5,
          indent: 14,
          spacingBefore: 1,
          spacingAfter: 2,
          color: [0.15, 0.2, 0.28],
        });
      }
      continue;
    }

    if (trimmed === "---" || trimmed === "***") {
      lines.push({
        text: "",
        font: "F1",
        size: 8,
        indent: 0,
        spacingBefore: 6,
        spacingAfter: 6,
        isRule: true,
      });
      continue;
    }

    if (trimmed === "[PAGE_BREAK]") {
      lines.push({
        text: "",
        font: "F1",
        size: 10,
        indent: 0,
        spacingBefore: 0,
        spacingAfter: 0,
        isPageBreak: true,
      });
      continue;
    }

    // Headings
    if (trimmed.startsWith("# ")) {
      const headingText = trimmed.slice(2).replace(/\*\*/g, "").trim();
      for (const w of wrapLine(headingText, 58)) {
        lines.push({
          text: w,
          font: "F2",
          size: 16,
          indent: 0,
          spacingBefore: 10,
          spacingAfter: 4,
          color: [0.08, 0.12, 0.2],
        });
      }
      continue;
    }

    if (trimmed.startsWith("## ")) {
      const headingText = trimmed.slice(3).replace(/\*\*/g, "").trim();
      for (const w of wrapLine(headingText, 64)) {
        lines.push({
          text: w,
          font: "F2",
          size: 13.5,
          indent: 0,
          spacingBefore: 8,
          spacingAfter: 3,
          color: [0.85, 0.29, 0.07],
        });
      }
      continue;
    }

    if (trimmed.startsWith("### ")) {
      const headingText = trimmed.slice(4).replace(/\*\*/g, "").trim();
      for (const w of wrapLine(headingText, 70)) {
        lines.push({
          text: w,
          font: "F2",
          size: 11.5,
          indent: 0,
          spacingBefore: 6,
          spacingAfter: 2,
          color: [0.12, 0.16, 0.24],
        });
      }
      continue;
    }

    // Bullet points
    if (/^[-*+]\s+/.test(trimmed)) {
      const bulletBody = trimmed.replace(/^[-*+]\s+/, "").replace(/\*\*([^*]+)\*\*/g, "$1");
      const wrapped = wrapLine(bulletBody, 76);
      wrapped.forEach((w, idx) => {
        lines.push({
          text: idx === 0 ? `-  ${w}` : `   ${w}`,
          font: "F1",
          size: 10.5,
          indent: 10,
          spacingBefore: idx === 0 ? 2 : 1,
          spacingAfter: 2,
          color: [0.15, 0.18, 0.22],
        });
      });
      continue;
    }

    // Numbered list
    const numMatch = trimmed.match(/^(\d+[.)])\s+(.+)$/);
    if (numMatch) {
      const numPrefix = numMatch[1];
      const numBody = numMatch[2].replace(/\*\*([^*]+)\*\*/g, "$1");
      const wrapped = wrapLine(numBody, 75);
      wrapped.forEach((w, idx) => {
        lines.push({
          text: idx === 0 ? `${numPrefix} ${w}` : `    ${w}`,
          font: "F1",
          size: 10.5,
          indent: 10,
          spacingBefore: idx === 0 ? 2 : 1,
          spacingAfter: 2,
          color: [0.15, 0.18, 0.22],
        });
      });
      continue;
    }

    // Markdown Table Row (e.g. | Name | Role | Status |)
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      // Skip separator row like |---|---|
      if (/^\|[\s-:|]+\|$/.test(trimmed)) {
        lines.push({
          text: "--------------------------------------------------------------------------------",
          font: "F3",
          size: 8.5,
          indent: 0,
          spacingBefore: 1,
          spacingAfter: 2,
          color: [0.6, 0.64, 0.7],
        });
        continue;
      }
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.replace(/\*\*/g, "").trim());
      const colWidth = Math.max(12, Math.floor(74 / Math.max(1, cells.length)));
      const formattedRow = cells
        .map((c) => (c.length > colWidth ? c.slice(0, colWidth - 1) + "." : c.padEnd(colWidth, " ")))
        .join(" | ");
      lines.push({
        text: formattedRow.slice(0, 86),
        font: "F3",
        size: 9,
        indent: 4,
        spacingBefore: 2,
        spacingAfter: 2,
        color: [0.1, 0.14, 0.22],
      });
      continue;
    }

    // Empty line
    if (!trimmed) {
      lines.push({
        text: "",
        font: "F1",
        size: 7,
        indent: 0,
        spacingBefore: 0,
        spacingAfter: 4,
      });
      continue;
    }

    // Bold-only line
    const isBoldLine = /^\*\*[^*]+\*\*$/.test(trimmed);
    const cleanText = trimmed
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1");

    const wrapped = wrapLine(cleanText, 82);
    for (const w of wrapped) {
      lines.push({
        text: w,
        font: isBoldLine ? "F2" : "F1",
        size: 10.5,
        indent: 0,
        spacingBefore: 1,
        spacingAfter: 2.5,
        color: [0.15, 0.18, 0.22],
      });
    }
  }

  return lines;
}

/** Build raw PDF 1.4 binary Uint8Array from a PdfDocumentInput */
export function buildPdfBytes(doc: PdfDocumentInput): Uint8Array {
  const pageWidth = 595.28; // A4 width in pt
  const pageHeight = 841.89; // A4 height in pt
  const marginX = 50;
  const topY = pageHeight - 55;
  const bottomY = 55;

  const title = sanitizePdfText(doc.title || "Document Report");
  const subtitle = sanitizePdfText(
    doc.subtitle || `Generated by My AI Pro • ${doc.date || new Date().toLocaleDateString()}`,
  );

  const styledLines = parseContentToStyledLines(doc);

  // Paginate lines into page content streams
  const pageStreams: string[] = [];
  let currentCommands: string[] = [];
  let cursorY = topY;

  function startNewPage(isFirstPage: boolean) {
    if (currentCommands.length > 0) {
      pageStreams.push(currentCommands.join("\n"));
    }
    currentCommands = [];
    cursorY = topY;

    if (isFirstPage) {
      // Top accent header bar
      currentCommands.push("0.85 0.29 0.07 rg");
      currentCommands.push(`${marginX} ${cursorY - 4} ${pageWidth - marginX * 2} 4 re f`);
      cursorY -= 26;

      // Document Title
      const titleLines = wrapLine(title, 48);
      for (const tl of titleLines) {
        currentCommands.push("BT");
        currentCommands.push("/F2 20 Tf");
        currentCommands.push("0.07 0.09 0.15 rg");
        currentCommands.push(`${marginX} ${cursorY.toFixed(2)} Td`);
        currentCommands.push(`(${escapePdfLiteral(tl)}) Tj`);
        currentCommands.push("ET");
        cursorY -= 24;
      }

      // Subtitle / Metadata
      currentCommands.push("BT");
      currentCommands.push("/F1 9.5 Tf");
      currentCommands.push("0.42 0.45 0.50 rg");
      currentCommands.push(`${marginX} ${cursorY.toFixed(2)} Td`);
      currentCommands.push(`(${escapePdfLiteral(subtitle)}) Tj`);
      currentCommands.push("ET");
      cursorY -= 14;

      // Divider rule
      currentCommands.push("0.85 0.87 0.90 RG");
      currentCommands.push("0.75 w");
      currentCommands.push(`${marginX} ${cursorY.toFixed(2)} m ${pageWidth - marginX} ${cursorY.toFixed(2)} l S`);
      cursorY -= 18;
    } else {
      // Running header on subsequent pages
      currentCommands.push("BT");
      currentCommands.push("/F1 8.5 Tf");
      currentCommands.push("0.50 0.53 0.58 rg");
      currentCommands.push(`${marginX} ${cursorY.toFixed(2)} Td`);
      currentCommands.push(`(${escapePdfLiteral(title.slice(0, 70))}) Tj`);
      currentCommands.push("ET");
      cursorY -= 8;
      currentCommands.push("0.88 0.90 0.92 RG");
      currentCommands.push("0.5 w");
      currentCommands.push(`${marginX} ${cursorY.toFixed(2)} m ${pageWidth - marginX} ${cursorY.toFixed(2)} l S`);
      cursorY -= 18;
    }
  }

  startNewPage(true);

  for (const item of styledLines) {
    if (item.isPageBreak) {
      startNewPage(false);
      continue;
    }

    const neededHeight = item.spacingBefore + item.size * 1.25 + item.spacingAfter;
    if (cursorY - neededHeight < bottomY) {
      startNewPage(false);
    }

    cursorY -= item.spacingBefore;

    if (item.isRule) {
      currentCommands.push("0.82 0.85 0.88 RG");
      currentCommands.push("0.6 w");
      currentCommands.push(`${marginX} ${cursorY.toFixed(2)} m ${pageWidth - marginX} ${cursorY.toFixed(2)} l S`);
      cursorY -= item.spacingAfter + 4;
      continue;
    }

    if (item.text) {
      const [r, g, b] = item.color || [0.15, 0.18, 0.22];
      currentCommands.push("BT");
      currentCommands.push(`/${item.font} ${item.size} Tf`);
      currentCommands.push(`${r.toFixed(2)} ${g.toFixed(2)} ${b.toFixed(2)} rg`);
      currentCommands.push(`${(marginX + item.indent).toFixed(2)} ${cursorY.toFixed(2)} Td`);
      currentCommands.push(`(${escapePdfLiteral(item.text)}) Tj`);
      currentCommands.push("ET");
    }

    cursorY -= item.size * 1.25 + item.spacingAfter;
  }

  if (currentCommands.length > 0) {
    pageStreams.push(currentCommands.join("\n"));
  }

  const totalPages = pageStreams.length;

  // Append page numbers to each page stream
  const finalizedStreams = pageStreams.map((stream, idx) => {
    const footerText = `Page ${idx + 1} of ${totalPages}  |  My AI Pro PDF Engine`;
    const footerCmd = [
      "0.88 0.90 0.92 RG",
      "0.5 w",
      `${marginX} 42 m ${pageWidth - marginX} 42 l S`,
      "BT",
      "/F1 8.5 Tf",
      "0.48 0.51 0.56 rg",
      `${marginX} 28 Td`,
      `(${escapePdfLiteral(footerText)}) Tj`,
      "ET",
    ].join("\n");
    return `${stream}\n${footerCmd}`;
  });

  // Assemble PDF 1.4 objects
  // Object 1: Catalog
  // Object 2: Pages
  // Object 3: Font F1 (Helvetica)
  // Object 4: Font F2 (Helvetica-Bold)
  // Object 5: Font F3 (Courier)
  // Objects 6..(5 + totalPages*2): Page & Content stream pairs
  const objects: string[] = [];
  objects[1] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`;

  const pageObjIds: number[] = [];
  let nextObjId = 6;

  for (let i = 0; i < totalPages; i++) {
    const pageObjId = nextObjId++;
    const contentObjId = nextObjId++;
    pageObjIds.push(pageObjId);

    const streamData = finalizedStreams[i];
    objects[contentObjId] =
      `${contentObjId} 0 obj\n<< /Length ${streamData.length} >>\nstream\n${streamData}\nendstream\nendobj`;

    objects[pageObjId] =
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentObjId} 0 R >>\nendobj`;
  }

  const kidsArray = pageObjIds.map((id) => `${id} 0 R`).join(" ");
  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${kidsArray}] /Count ${totalPages} >>\nendobj`;
  objects[3] = `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj`;
  objects[4] = `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj`;
  objects[5] = `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>\nendobj`;

  let pdfBody = "%PDF-1.4\n";
  const offsets: number[] = [];
  const totalObjects = nextObjId - 1;

  for (let i = 1; i <= totalObjects; i++) {
    offsets[i] = pdfBody.length;
    pdfBody += objects[i] + "\n";
  }

  const xrefOffset = pdfBody.length;
  pdfBody += `xref\n0 ${totalObjects + 1}\n`;
  pdfBody += `0000000000 65535 f \n`;
  for (let i = 1; i <= totalObjects; i++) {
    const offStr = String(offsets[i]).padStart(10, "0");
    pdfBody += `${offStr} 00000 n \n`;
  }

  pdfBody += `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const encoder = new TextEncoder();
  return encoder.encode(pdfBody);
}

/** Generate a downloadable application/pdf Blob */
export function generatePdfBlob(doc: PdfDocumentInput): Blob {
  const bytes = buildPdfBytes(doc);
  return new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
}

/** Generate a base64 data URL (data:application/pdf;base64,...) for a PDF document */
export function generatePdfDataUrl(doc: PdfDocumentInput): string {
  const bytes = buildPdfBytes(doc);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:application/pdf;base64,${btoa(binary)}`;
}

/** Trigger an immediate browser download of a PDF from a dataUrl or PdfDocumentInput */
export function triggerPdfDownload(
  source: string | PdfDocumentInput,
  filename = "document.pdf",
) {
  const blob =
    typeof source === "string"
      ? (() => {
          const base64 = source.includes(",") ? source.split(",")[1] : source;
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          return new Blob([bytes], { type: "application/pdf" });
        })()
      : generatePdfBlob(source);

  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 8000);
}

/** Join / Merge multiple PdfDocumentInput items into a single multi-section PDF */
export function joinPdfDocuments(
  docs: PdfDocumentInput[],
  joinedTitle?: string,
): { blob: Blob; combinedDoc: PdfDocumentInput } {
  const validDocs = docs.filter((d) => d && (d.content?.trim() || d.title?.trim()));
  const mainTitle =
    joinedTitle ||
    (validDocs.length > 1
      ? `Joined Document (${validDocs.map((d) => d.title).join(" + ").slice(0, 60)})`
      : validDocs[0]?.title || "Joined PDF Document");

  const combinedSections = validDocs.map((d, idx) => {
    const header = `# Section ${idx + 1}: ${d.title || `Document ${idx + 1}`}`;
    const meta = d.subtitle ? `*${d.subtitle}*\n` : "";
    return `${header}\n${meta}\n${(d.content || "").trim()}`;
  });

  const combinedDoc: PdfDocumentInput = {
    title: mainTitle,
    subtitle: `Combined PDF (${validDocs.length} joined section${validDocs.length === 1 ? "" : "s"}) • ${new Date().toLocaleDateString()}`,
    filename: `${mainTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "joined-document"}.pdf`,
    content: combinedSections.join("\n\n[PAGE_BREAK]\n\n"),
  };

  return {
    blob: generatePdfBlob(combinedDoc),
    combinedDoc,
  };
}

/** Extract readable text from an uploaded raw PDF file buffer for joining/merging */
export function extractTextFromPdfBuffer(buffer: ArrayBuffer, fallbackName: string): string {
  try {
    const decoder = new TextDecoder("latin1");
    const raw = decoder.decode(buffer);

    // Extract literal strings inside BT ... ET text blocks
    const textChunks: string[] = [];
    const btEtRegex = /BT([\s\S]*?)ET/g;
    let blockMatch;
    while ((blockMatch = btEtRegex.exec(raw)) !== null) {
      const block = blockMatch[1];
      const strRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g;
      let strMatch;
      const blockLines: string[] = [];
      while ((strMatch = strRegex.exec(block)) !== null) {
        const cleaned = strMatch[1]
          .replace(/\\\(/g, "(")
          .replace(/\\\)/g, ")")
          .replace(/\\\\/g, "\\")
          .replace(/[^\x20-\x7E]/g, " ")
          .trim();
        if (cleaned) blockLines.push(cleaned);
      }
      if (blockLines.length > 0) {
        textChunks.push(blockLines.join(" "));
      }
    }

    if (textChunks.length > 0) {
      return textChunks.join("\n");
    }

    // Fallback: look for general parenthesized printable strings
    const genericMatches = raw.match(/\([A-Za-z0-9 ,.;:'"?!\-_/]{4,}\)/g);
    if (genericMatches && genericMatches.length > 0) {
      return genericMatches
        .slice(0, 200)
        .map((m) => m.slice(1, -1))
        .join(" ");
    }
  } catch {
    // ignore
  }
  return `Joined PDF Attachment: ${fallbackName}`;
}

/**
 * Extract structured spreadsheet rows & columns from markdown tables or CSV blocks in an AI response.
 */
export function extractSpreadsheetFromContent(content: string): {
  title: string;
  headers: string[];
  rows: string[][];
} | null {
  const lines = content.replace(/\r\n/g, "\n").split("\n");

  let detectedTitle = "Spreadsheet_Data";
  for (const l of lines) {
    const h = l.trim().match(/^#{1,3}\s+(.+)$/);
    if (h) {
      detectedTitle = h[1].replace(/\*\*/g, "").trim();
      break;
    }
  }

  // 1. Check for markdown tables: | Col1 | Col2 |
  const tableLines: string[] = [];
  let inTable = false;
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("|") && t.endsWith("|") && t.split("|").length >= 3) {
      inTable = true;
      tableLines.push(t);
    } else if (inTable) {
      if (tableLines.length >= 2) break;
      tableLines.length = 0;
      inTable = false;
    }
  }

  if (tableLines.length >= 2) {
    const parsedRows = tableLines
      .filter((l) => !/^\|[\s-:|]+\|$/.test(l))
      .map((l) =>
        l
          .slice(1, -1)
          .split("|")
          .map((c) => c.replace(/\*\*/g, "").trim()),
      );

    if (parsedRows.length >= 1) {
      const headers = parsedRows[0];
      const rows = parsedRows.slice(1);
      return { title: detectedTitle, headers, rows };
    }
  }

  // 2. Check for ```csv or ```spreadsheet code blocks
  const csvBlock = content.match(/```(?:csv|tsv|spreadsheet|excel)\s*\n([\s\S]*?)```/i);
  if (csvBlock && csvBlock[1]) {
    const csvLines = csvBlock[1]
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (csvLines.length >= 2) {
      const parseCsvLine = (line: string): string[] => {
        const res: string[] = [];
        let cur = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            inQuotes = !inQuotes;
          } else if ((ch === "," || ch === "\t") && !inQuotes) {
            res.push(cur.trim());
            cur = "";
          } else {
            cur += ch;
          }
        }
        res.push(cur.trim());
        return res;
      };
      const all = csvLines.map(parseCsvLine);
      return {
        title: detectedTitle,
        headers: all[0],
        rows: all.slice(1),
      };
    }
  }

  return null;
}

/**
 * Convert headers + rows into clean RFC-4180 CSV string
 */
export function buildCsvString(headers: string[], rows: string[][]): string {
  const escapeCell = (val: string) => {
    const s = String(val ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const headerLine = headers.map(escapeCell).join(",");
  const rowLines = rows.map((r) => headers.map((_, idx) => escapeCell(r[idx] ?? "")).join(","));
  return [headerLine, ...rowLines].join("\n");
}

/**
 * Trigger browser download of a Spreadsheet as .csv or Excel-compatible .xls
 */
export function triggerSpreadsheetDownload(
  headers: string[],
  rows: string[][],
  filename = "Spreadsheet",
  format: "csv" | "xls" = "csv",
) {
  const cleanName =
    filename
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 50) || "Spreadsheet";

  if (format === "xls") {
    const escapeHtml = (s: string) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const htmlTable = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8" /><style>
  table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11pt; }
  th { background-color: #18181b; color: #ffffff; font-weight: bold; border: 1px solid #d4d4d8; padding: 8px 12px; text-align: left; }
  td { border: 1px solid #e4e4e7; padding: 6px 12px; }
  tr:nth-child(even) td { background-color: #fafafa; }
</style></head>
<body>
  <table>
    <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
    <tbody>
      ${rows
        .map(
          (r) =>
            `<tr>${headers.map((_, i) => `<td>${escapeHtml(r[i] ?? "")}</td>`).join("")}</tr>`,
        )
        .join("")}
    </tbody>
  </table>
</body></html>`;
    const blob = new Blob([htmlTable], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cleanName}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 6000);
    return;
  }

  const csv = buildCsvString(headers, rows);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${cleanName}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 6000);
}

