import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/shell";
import { DashboardActionForm } from "@/components/dashboard-action-form";
import { DashboardRecentLeadsTable } from "@/components/dashboard-recent-leads-table";
import { DashboardStatsTabs } from "@/components/dashboard-stats-tabs";
import { nonKoreanCompanyWhere } from "@/lib/korea-exclusion";
import { getOperationsSettings } from "@/lib/operations-settings";

export default async function DashboardPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [
    emailsSentToday,
    articlesToday,
    processedArticlesToday,
    unprocessedArticlesToday,
    gradeALeadsToday,
    totalLeadsToday,
    totalEmailsSent,
    totalArticles,
    analyzedArticles,
    unprocessedArticles,
    totalLeads,
    totalGradeALeads,
    lastRun,
    recentLeads,
    operationsSettings
  ] =
    await Promise.all([
      prisma.outreachMessage.count({ where: { channel: "email", status: "sent", updatedAt: { gte: today }, opportunity: { company: nonKoreanCompanyWhere } } }),
      prisma.article.count({ where: { createdAt: { gte: today } } }),
      prisma.article.count({ where: { processed: true, createdAt: { gte: today } } }),
      prisma.article.count({ where: { processed: false, createdAt: { gte: today } } }),
      prisma.opportunity.count({ where: { grade: "A", createdAt: { gte: today }, company: nonKoreanCompanyWhere } }),
      prisma.opportunity.count({ where: { createdAt: { gte: today }, company: nonKoreanCompanyWhere } }),
      prisma.outreachMessage.count({ where: { channel: "email", status: "sent", opportunity: { company: nonKoreanCompanyWhere } } }),
      prisma.article.count(),
      prisma.article.count({ where: { processed: true } }),
      prisma.article.count({ where: { processed: false } }),
      prisma.opportunity.count({ where: { company: nonKoreanCompanyWhere } }),
      prisma.opportunity.count({ where: { grade: "A", company: nonKoreanCompanyWhere } }),
      prisma.crawlRun.findFirst({ orderBy: { startedAt: "desc" } }),
      prisma.opportunity.findMany({
        where: { company: nonKoreanCompanyWhere },
        include: { company: true, game: true, article: { include: { source: true } } },
        orderBy: [{ grade: "asc" }, { score: "desc" }],
        take: 8
      }),
      getOperationsSettings()
    ]);
  const lastCrawlIssue = lastRun?.errorMessage?.split("\n").filter(Boolean)[0];

  return (
    <Shell title="Dashboard" subtitle="Pre-launch game sales opportunities for QROAD">
      <DashboardStatsTabs
        daily={[
          { label: "Emails sent today", value: emailsSentToday, hint: `Daily email sending limit: ${operationsSettings.autoEmailDailyLimit}` },
          { label: "Grade A leads today", value: gradeALeadsToday, hint: `Total leads today: ${totalLeadsToday}` },
          { label: "Crawled articles today", value: articlesToday, hint: `${processedArticlesToday} processed today / ${unprocessedArticlesToday} unprocessed today` }
        ]}
        total={[
          { label: "Total email sent", value: totalEmailsSent, hint: `Sent today: ${emailsSentToday}/${operationsSettings.autoEmailDailyLimit}` },
          { label: "Total Grade A leads", value: totalGradeALeads, hint: `Total leads: ${totalLeads}` },
          { label: "Total crawled articles", value: totalArticles, hint: `${analyzedArticles} processed / ${unprocessedArticles} unprocessed` }
        ]}
      />
      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1fr)", marginTop: 16 }}>
        <section className="panel">
          <h2>Operations</h2>
          <div className="actions">
            <DashboardActionForm action="/api/crawl" kind="crawl" />
            <DashboardActionForm action="/api/analyze" kind="analyze" />
          </div>
          {lastCrawlIssue ? (
            <div className="operation-error-card">
              <div className="operation-error-header">
                <span className="badge status-failed">last crawl issue</span>
                <span>{lastRun?.finishedAt?.toLocaleString() ?? lastRun?.startedAt.toLocaleString()}</span>
              </div>
              <p>{lastCrawlIssue}</p>
            </div>
          ) : (
            <p className="operation-empty-log">No issue reported by the latest crawl.</p>
          )}
        </section>
        <section className="panel">
          <h2>Recent Leads</h2>
          <DashboardRecentLeadsTable
            leads={recentLeads.map((lead) => ({
              id: lead.id,
              grade: lead.grade,
              score: lead.score,
              company: lead.company.name,
              website: lead.company.website,
              email: lead.company.contactEmail,
              game: lead.game.title
            }))}
          />
        </section>
      </div>
    </Shell>
  );
}
