import { Shell } from "@/components/shell";
import { LeadEnrichmentTable } from "@/components/lead-enrichment-table";
import { getEmailBodyTemplate } from "@/lib/email-template";
import { nonKoreanCompanyWhere } from "@/lib/korea-exclusion";
import { prisma } from "@/lib/prisma";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const companyWhere = {
    ...nonKoreanCompanyWhere,
    ...(params.country ? { country: params.country } : {}),
    ...(params.enrichmentStatus ? { enrichmentStatus: params.enrichmentStatus } : {}),
    ...(params.emailStatus === "has_email" ? { contactEmail: { not: null } } : {}),
    ...(params.emailStatus === "no_email" ? { contactEmail: null } : {}),
    ...(params.emailStatus === "not_found" ? { contactEmail: null, enrichmentStatus: { not: "not_started" } } : {})
  };
  const where = {
    ...(params.grade ? { grade: params.grade } : {}),
    ...(Object.keys(companyWhere).length ? { company: companyWhere } : {}),
    ...(params.stage ? { game: { launchStage: params.stage } } : {})
  };
  const [leads, countries, stages, emailBodyTemplate] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      include: { company: true, game: true, article: { include: { source: true } } },
      orderBy: [{ grade: "asc" }, { score: "desc" }]
    }),
    prisma.company.findMany({ where: nonKoreanCompanyWhere, select: { country: true }, distinct: ["country"], orderBy: { country: "asc" } }),
    prisma.game.findMany({ select: { launchStage: true }, distinct: ["launchStage"], orderBy: { launchStage: "asc" } }),
    getEmailBodyTemplate()
  ]);
  return (
    <Shell title="Lead List" subtitle="Qualified QROAD opportunities with scoring, packages, and status.">
      {params.enriched ? <p className="notice">Enrichment finished for {params.enriched} lead(s).</p> : null}
      {params.analyzed ? (
        <p className={params.analysisFailed && params.analysisFailed !== "0" ? "notice warning" : "notice"}>
          Analysis finished for {params.analyzed} article(s)
          {params.analysisFailed && params.analysisFailed !== "0" ? `, with ${params.analysisFailed} failure(s).` : "."}
        </p>
      ) : null}
      {params.autoEmailSent && (params.autoEmailSent !== "0" || params.autoEmailFailed !== "0" || (params.autoEmail && params.autoEmail !== "disabled")) ? (
        <p className={params.autoEmailFailed && params.autoEmailFailed !== "0" ? "notice warning" : "notice"}>
          Automatic email pass sent {params.autoEmailSent} email(s)
          {params.autoEmailFailed && params.autoEmailFailed !== "0" ? `, with ${params.autoEmailFailed} failure(s).` : "."}
          {params.autoEmail ? ` Status: ${params.autoEmail.replaceAll("_", " ")}.` : ""}
        </p>
      ) : null}
      <div className="lead-list-section">
        <LeadEnrichmentTable
          emailBodyTemplate={emailBodyTemplate}
          filterOptions={{
            countries: countries.map((country) => country.country).filter(Boolean),
            stages: stages.map((stage) => stage.launchStage).filter(Boolean),
            values: {
              country: params.country,
              emailStatus: params.emailStatus,
              enrichmentStatus: params.enrichmentStatus,
              grade: params.grade,
              stage: params.stage
            }
          }}
          leads={leads.map((lead) => ({
            id: lead.id,
            grade: lead.grade,
            score: lead.score,
            status: lead.status.replaceAll("_", " "),
            company: lead.company.name,
            country: lead.company.country,
            game: lead.game.title,
            platform: lead.game.platform,
            stage: lead.game.launchStage.replaceAll("_", " "),
            packages: JSON.parse(lead.recommendedPackages).join(", "),
            source: lead.article.source.name,
            enrichmentStatus: lead.company.enrichmentStatus,
            enrichmentConfidence: lead.company.enrichmentConfidence,
            website: lead.company.website,
            email: lead.company.contactEmail,
            emailChecked: lead.company.enrichmentStatus !== "not_started" || Boolean(lead.company.lastEnrichedAt)
          }))}
        />
      </div>
    </Shell>
  );
}
