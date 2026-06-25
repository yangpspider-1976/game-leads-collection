import type { Article, Source } from "@prisma/client";
import { analyzeArticle } from "./openai-analysis";
import { isKoreanArticle, isKoreanCountry } from "./korea-exclusion";
import { shouldAnalyzeArticle } from "./prefilter";
import { prisma } from "./prisma";

type ArticleWithSource = Article & { source: Source };

export async function processArticle(article: ArticleWithSource) {
  if (isKoreanArticle(article)) {
    await prisma.article.update({ where: { id: article.id }, data: { processed: true, excluded: true } });
    return { status: "excluded" as const, provider: "korea_exclusion" as const };
  }

  const prefilter = shouldAnalyzeArticle(article);
  if (prefilter.action === "exclude") {
    await prisma.article.update({ where: { id: article.id }, data: { processed: true, excluded: true } });
    return { status: "excluded" as const, provider: "prefilter" as const };
  }

  const result = await analyzeArticle(article);
  const analysis = result.analysis;

  if (isKoreanCountry(analysis.company.country)) {
    await prisma.article.update({ where: { id: article.id }, data: { processed: true, excluded: true } });
    return { status: "excluded" as const, provider: result.provider };
  }

  if (result.fullContent !== article.rawContent && result.fullContent.length > article.rawContent.length) {
    await prisma.article.update({
      where: { id: article.id },
      data: { rawContent: result.fullContent.slice(0, Number(process.env.MAX_STORED_ARTICLE_CHARS ?? 20000)) }
    });
  }

  if (result.error) {
    await prisma.systemLog.create({
      data: {
        level: "warning",
        module: "ai",
        message: `Analysis fallback for article: ${result.error}`,
        metadata: JSON.stringify({ articleId: article.id, provider: result.provider, url: article.url })
      }
    });
  }

  if (!analysis.is_relevant && analysis.game.launch_stage !== "unknown" && prefilter.action !== "needs_research") {
    await prisma.article.update({ where: { id: article.id }, data: { processed: true, excluded: true } });
    return { status: "excluded" as const, provider: result.provider };
  }

  const company = await prisma.company.create({
    data: {
      name: analysis.company.name || "Needs research",
      country: analysis.company.country,
      companyType: analysis.company.company_type
    }
  });
  const game = await prisma.game.create({
    data: {
      title: analysis.game.title,
      platform: analysis.game.platforms.join(", ") || "unknown",
      genre: analysis.game.genre,
      launchStage: analysis.game.launch_stage,
      expectedLaunchDate: analysis.game.expected_launch_date ? new Date(analysis.game.expected_launch_date) : null
    }
  });
  await prisma.opportunity.create({
    data: {
      articleId: article.id,
      companyId: company.id,
      gameId: game.id,
      targetRegion: analysis.company.country,
      opportunityType: analysis.opportunity.opportunity_type,
      score: analysis.opportunity.score,
      grade: analysis.opportunity.grade,
      status: analysis.is_relevant && prefilter.action !== "needs_research" ? "new" : "needs_research",
      recommendedPackages: JSON.stringify(analysis.opportunity.recommended_packages),
      reasoning: prefilter.reason ?? analysis.relevance_reason,
      evidenceQuotes: JSON.stringify(analysis.evidence.key_quotes),
      uncertainty: analysis.uncertainty ?? prefilter.reason ?? null,
      nextAction: analysis.opportunity.next_action
    }
  });
  await prisma.article.update({ where: { id: article.id }, data: { processed: true } });
  return {
    status: prefilter.action === "needs_research" || !analysis.is_relevant ? ("needs_research" as const) : ("created" as const),
    provider: result.provider
  };
}

export function prioritizeArticles<T extends { source: { region: string; priority: number }; publishedAt: Date | null }>(articles: T[]) {
  return articles.sort((a, b) => {
    const regionScore = scoreRegion(b.source.region) - scoreRegion(a.source.region);
    if (regionScore !== 0) return regionScore;
    const priorityScore = a.source.priority - b.source.priority;
    if (priorityScore !== 0) return priorityScore;
    return (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
  });
}

function scoreRegion(region: string) {
  if (region === "japan") return 2;
  if (region === "north_america") return 1;
  return 0;
}
