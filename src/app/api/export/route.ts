import { nonKoreanCompanyWhere } from "@/lib/korea-exclusion";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "csv";
  const grade = url.searchParams.get("grade") ?? undefined;
  const type = url.searchParams.get("type") ?? "all";
  const leads = await prisma.opportunity.findMany({
    where: {
      ...(grade ? { grade } : {}),
      company: {
        ...nonKoreanCompanyWhere,
        ...(type === "enriched" ? { enrichmentStatus: { in: ["completed", "partial", "manual_review"] } } : {})
      }
    },
    include: { company: true, game: true, article: { include: { source: true } } },
    orderBy: [{ grade: "asc" }, { score: "desc" }]
  });
  const rows = leads.map((lead) => ({
    grade: lead.grade,
    score: lead.score,
    status: lead.status,
    company: lead.company.name,
    country: lead.company.country,
    game: lead.game.title,
    platform: lead.game.platform,
    launch_stage: lead.game.launchStage,
    opportunity_type: lead.opportunityType,
    packages: JSON.parse(lead.recommendedPackages).join("; "),
    source: lead.article.source.name,
    source_url: lead.article.url,
    next_action: lead.nextAction,
    website: lead.company.website,
    contact_page: lead.company.contactUrl,
    primary_email: lead.company.contactEmail,
    secondary_emails: parseJsonArray(lead.company.secondaryEmails).join("; "),
    primary_phone: lead.company.contactPhone,
    secondary_phones: parseJsonArray(lead.company.secondaryPhones).join("; "),
    facebook: lead.company.facebookUrl,
    instagram: lead.company.instagramUrl,
    linkedin: lead.company.linkedinUrl,
    tiktok: lead.company.tiktokUrl,
    youtube: lead.company.youtubeUrl,
    twitter: lead.company.twitterUrl,
    enrichment_status: lead.company.enrichmentStatus,
    enrichment_confidence: lead.company.enrichmentConfidence,
    enrichment_sources: parseJsonArray(lead.company.enrichmentSources).join("; "),
    enrichment_notes: lead.company.enrichmentManualNotes
  }));

  if (format === "xls") {
    const body = toExcelXml(rows);
    return new Response(body, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="gamelead-radar-${grade ?? "all"}.xls"`
      }
    });
  }

  const csv = toCsv(rows);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gamelead-radar-${grade ?? "all"}.csv"`
    }
  });
}

function parseJsonArray(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function toExcelXml(rows: Record<string, unknown>[]) {
  const headers = Object.keys(rows[0] ?? { grade: "", score: "", company: "", game: "" });
  const rowXml = [headers, ...rows.map((row) => headers.map((header) => row[header]))]
    .map(
      (cells) =>
        `<Row>${cells
          .map((cell) => `<Cell><Data ss:Type="String">${escapeXml(String(cell ?? ""))}</Data></Cell>`)
          .join("")}</Row>`
    )
    .join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="leads"><Table>${rowXml}</Table></Worksheet>
</Workbook>`;
}

function escapeXml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = String(row[header] ?? "");
          return `"${value.replaceAll('"', '""')}"`;
        })
        .join(",")
    )
  ].join("\n");
}
