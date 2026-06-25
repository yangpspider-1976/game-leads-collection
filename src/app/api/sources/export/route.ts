import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const sources = await prisma.source.findMany({ orderBy: { name: "asc" } });
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GameLead Radar";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Registered Sources", {
    views: [{ state: "frozen", ySplit: 1 }]
  });

  sheet.columns = [
    { header: "Source", key: "name", width: 26 },
    { header: "URL", key: "url", width: 48 },
    { header: "Resolved Feed URL", key: "resolvedFeedUrl", width: 48 },
    { header: "Region", key: "region", width: 18 },
    { header: "Language", key: "language", width: 12 },
    { header: "Type", key: "sourceType", width: 18 },
    { header: "Status", key: "verificationStatus", width: 18 },
    { header: "Verification Error", key: "verificationError", width: 40 },
    { header: "Priority", key: "priority", width: 10 },
    { header: "Reliability", key: "reliability", width: 14 },
    { header: "Failures", key: "consecutiveFailures", width: 10 },
    { header: "Active", key: "active", width: 10 },
    { header: "Last Verified", key: "lastVerifiedAt", width: 20 },
    { header: "Last Crawl", key: "lastCrawledAt", width: 20 },
    { header: "Frequency Hours", key: "crawlFrequencyHours", width: 16 },
    { header: "Max Items Per Run", key: "maxItemsPerRun", width: 18 },
    { header: "Notes", key: "notes", width: 40 }
  ];

  for (const source of sources) {
    sheet.addRow({
      ...source,
      active: source.active ? "Yes" : "No",
      lastVerifiedAt: source.lastVerifiedAt ?? "Never",
      lastCrawledAt: source.lastCrawledAt ?? "Never"
    });
  }

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
  header.alignment = { vertical: "middle" };
  header.height = 24;
  sheet.autoFilter = { from: "A1", to: "Q1" };
  sheet.getColumn("lastVerifiedAt").numFmt = "yyyy-mm-dd hh:mm";
  sheet.getColumn("lastCrawledAt").numFmt = "yyyy-mm-dd hh:mm";

  const data = await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="gamelead-radar-registered-sources.xlsx"',
      "Cache-Control": "no-store"
    }
  });
}
