import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { discoverRss, sourceTypes, verifySource } from "@/lib/source-validation";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const validSourceTypes = new Set<string>(sourceTypes);

type ImportSource = {
  name: string;
  url: string;
  resolvedFeedUrl: string | null;
  region: string;
  language: string;
  sourceType: string;
  active: boolean;
  priority: number;
  reliability: string;
  crawlFrequencyHours: number;
  maxItemsPerRun: number;
  notes: string | null;
};

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ success: false, error: "Choose an XLSX file to import." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return Response.json({ success: false, error: "Only .xlsx files are supported." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ success: false, error: "The XLSX file must be 10 MB or smaller." }, { status: 400 });
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) {
      return Response.json({ success: false, error: "The workbook does not contain any source rows." }, { status: 400 });
    }

    const headers = new Map<string, number>();
    sheet.getRow(1).eachCell((cell, column) => headers.set(normalizeHeader(cell.text), column));
    if (!headers.has("source") || !headers.has("url")) {
      return Response.json({ success: false, error: 'The workbook must contain "Source" and "URL" columns.' }, { status: 400 });
    }

    const imports = new Map<string, ImportSource>();
    const errors: string[] = [];
    let skipped = 0;
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const name = cellText(row, headers, "source");
      const url = cellText(row, headers, "url");
      if (!name && !url) return;
      if (!name || !isHttpUrl(url)) {
        skipped += 1;
        if (errors.length < 5) errors.push(`Row ${rowNumber}: a source name and valid HTTP(S) URL are required.`);
        return;
      }

      const sourceTypeValue = cellText(row, headers, "type") || "rss";
      if (!validSourceTypes.has(sourceTypeValue)) {
        skipped += 1;
        if (errors.length < 5) errors.push(`Row ${rowNumber}: unknown source type "${sourceTypeValue}".`);
        return;
      }

      if (imports.has(url)) skipped += 1;
      imports.set(url, {
        name,
        url,
        resolvedFeedUrl: nullableUrl(cellText(row, headers, "resolved feed url")),
        region: cellText(row, headers, "region") || "global",
        language: cellText(row, headers, "language") || "en",
        sourceType: sourceTypeValue,
        active: parseBoolean(cellText(row, headers, "active"), true),
        priority: boundedInteger(cellText(row, headers, "priority"), 3, 1, 5),
        reliability: cellText(row, headers, "reliability") || "medium",
        crawlFrequencyHours: boundedInteger(cellText(row, headers, "frequency hours"), 12, 1, 8760),
        maxItemsPerRun: boundedInteger(cellText(row, headers, "max items per run"), 30, 1, 100),
        notes: cellText(row, headers, "notes") || null
      });
    });

    if (errors.length > 0) {
      return Response.json({
        success: false,
        error: `Import stopped. Fix the workbook before replacing sources: ${errors.join(" ")}`
      }, { status: 400 });
    }

    if (imports.size === 0) {
      return Response.json({ success: false, error: errors[0] || "No valid source rows were found." }, { status: 400 });
    }

    const rows = [...imports.values()];
    const existing = await prisma.source.findMany({ where: { url: { in: rows.map((row) => row.url) } }, select: { url: true } });
    const existingUrls = new Set(existing.map((source) => source.url));
    const importedUrls = rows.map((row) => row.url);
    const synchronizedRows = rows.map((source) => ({
      ...source,
      active: source.sourceType === "rss_autodiscovery" ? false : source.active
    }));
    const results = await prisma.$transaction([
      prisma.source.deleteMany({ where: { url: { notIn: importedUrls } } }),
      ...synchronizedRows.map((source) => prisma.source.upsert({ where: { url: source.url }, update: source, create: source }))
    ]);

    const updated = rows.filter((source) => existingUrls.has(source.url)).length;
    const deleted = results[0].count;
    const automaticVerification = await verifyImportedAutoDiscoverySources(importedUrls);
    return Response.json({
      success: true,
      created: rows.length - updated,
      updated,
      deleted,
      skipped,
      errors,
      automaticVerification
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read the XLSX workbook.";
    return Response.json({ success: false, error: `Unable to import workbook: ${message}` }, { status: 400 });
  }
}

async function verifyImportedAutoDiscoverySources(importedUrls: string[]) {
  const sources = await prisma.source.findMany({
    where: { url: { in: importedUrls }, sourceType: "rss_autodiscovery" },
    orderBy: { name: "asc" }
  });
  const summary = { checked: sources.length, activated: 0, failed: 0 };

  for (let index = 0; index < sources.length; index += 4) {
    const batch = sources.slice(index, index + 4);
    const outcomes = await Promise.all(batch.map(async (source) => {
      try {
        await discoverRss(source, true);
        const refreshed = await prisma.source.findUnique({ where: { id: source.id } });
        if (!refreshed) return false;
        const result = await verifySource(refreshed, true);
        const activate = result.status === "ok" || result.status === "warning";
        await prisma.source.update({ where: { id: source.id }, data: { active: activate } });
        return activate;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Automatic source verification failed.";
        await prisma.source.update({
          where: { id: source.id },
          data: { active: false, verificationStatus: "needs_review", verificationError: message }
        });
        return false;
      }
    }));
    summary.activated += outcomes.filter(Boolean).length;
    summary.failed += outcomes.filter((activated) => !activated).length;
  }

  return summary;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ");
}

function cellText(row: ExcelJS.Row, headers: Map<string, number>, header: string) {
  const column = headers.get(header);
  return column ? row.getCell(column).text.trim() : "";
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function nullableUrl(value: string) {
  return value && isHttpUrl(value) ? value : null;
}

function parseBoolean(value: string, fallback: boolean) {
  if (["yes", "true", "1", "active"].includes(value.toLowerCase())) return true;
  if (["no", "false", "0", "inactive"].includes(value.toLowerCase())) return false;
  return fallback;
}

function boundedInteger(value: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}
