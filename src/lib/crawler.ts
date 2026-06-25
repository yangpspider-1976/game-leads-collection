import Parser from "rss-parser";
import * as cheerio from "cheerio";
import { prisma } from "./prisma";
import { contentHash } from "./analysis";
import { isKoreanArticle, isKoreanSource } from "./korea-exclusion";
import { crawlerHeaders, discoverRss, extractHtmlLinks } from "./source-validation";

const parser = new Parser({
  headers: crawlerHeaders()
});

export async function crawlActiveSources(options: { maxArticles?: number } = {}) {
  const run = await prisma.crawlRun.create({ data: { status: "running" } });
  let articlesFound = 0;
  let articlesSaved = 0;
  const errors: string[] = [];

  const sources = (await prisma.source.findMany({ where: { active: true }, orderBy: [{ priority: "asc" }, { name: "asc" }] })).filter(
    (source) => !isKoreanSource(source)
  );
  await crawlSources(orderSourcesForCrawl(sources), { runId: run.id, articlesFound, articlesSaved, errors, articleLimit: options.maxArticles });

  const finalRun = await prisma.crawlRun.findUniqueOrThrow({ where: { id: run.id } });
  return { articlesFound: finalRun.articlesFound, articlesSaved: finalRun.articlesSaved, errors };
}

export async function crawlSingleSource(sourceId: string) {
  const source = await prisma.source.findUniqueOrThrow({ where: { id: sourceId } });
  if (isKoreanSource(source)) {
    const run = await prisma.crawlRun.create({ data: { status: "success", finishedAt: new Date(), articlesFound: 0, articlesSaved: 0 } });
    return { articlesFound: run.articlesFound, articlesSaved: run.articlesSaved, errors: [] };
  }
  const run = await prisma.crawlRun.create({ data: { status: "running" } });
  const state = { runId: run.id, articlesFound: 0, articlesSaved: 0, errors: [] as string[] };
  await crawlSources([source], state);
  const finalRun = await prisma.crawlRun.findUniqueOrThrow({ where: { id: run.id } });
  return { articlesFound: finalRun.articlesFound, articlesSaved: finalRun.articlesSaved, errors: state.errors };
}

async function crawlSources(
  sources: Awaited<ReturnType<typeof prisma.source.findMany>>,
  state: { runId: string; articlesFound: number; articlesSaved: number; errors: string[]; articleLimit?: number }
) {
  for (const source of sources) {
    if (state.articleLimit && state.articlesSaved >= state.articleLimit) break;
    try {
      const collected = await collectSourceItems(source);
      const sourceLimit = source.maxItemsPerRun ?? Number(process.env.MAX_ITEMS_PER_SOURCE ?? 30);
      const remainingLimit = state.articleLimit ? Math.max(state.articleLimit - state.articlesSaved, 0) : sourceLimit;
      const selectedArticles = collected
        .filter((article) => !isKoreanArticle({ ...article, source }))
        .slice(0, Math.min(sourceLimit, remainingLimit));
      state.articlesFound += selectedArticles.length;
      for (const article of selectedArticles) {
        const hash = contentHash(`${article.title}|${article.url}|${article.rawContent}`);
        const saved = await prisma.article.upsert({
          where: { url: article.url },
          update: {},
          create: {
            sourceId: source.id,
            title: article.title,
            url: article.url,
            publishedAt: article.publishedAt,
            rawContent: article.rawContent,
            summary: article.summary,
            contentHash: hash
          }
        });
        if (saved.createdAt.getTime() > Date.now() - 15_000) state.articlesSaved += 1;
      }
      await prisma.source.update({
        where: { id: source.id },
        data: { lastCrawledAt: new Date(), consecutiveFailures: 0, verificationStatus: "ok", verificationError: null }
      });
    } catch (error) {
      const message = `${source.name}: ${error instanceof Error ? error.message : "Unknown crawl error"}`;
      state.errors.push(message);
      const consecutiveFailures = source.consecutiveFailures + 1;
      await prisma.systemLog.create({
        data: {
          level: "error",
          module: "crawler",
          message,
          metadata: JSON.stringify({ sourceId: source.id, sourceUrl: source.url })
        }
      });
      await prisma.source.update({
        where: { id: source.id },
        data: {
          verificationStatus: "needs_review",
          verificationError: message,
          lastVerifiedAt: new Date(),
          consecutiveFailures,
          active: consecutiveFailures >= Number(process.env.AUTO_DISABLE_AFTER_FAILURES ?? 3) ? false : source.active
        }
      });
    }
  }

  const status =
    state.errors.length === 0 ? "success" : state.articlesFound > 0 || state.articlesSaved > 0 ? "partial_success" : "failed";
  await prisma.crawlRun.update({
    where: { id: state.runId },
    data: {
      status,
      finishedAt: new Date(),
      articlesFound: state.articlesFound,
      articlesSaved: state.articlesSaved,
      errorMessage: state.errors.length ? state.errors.join("\n") : null
    }
  });
}

function orderSourcesForCrawl(sources: Awaited<ReturnType<typeof prisma.source.findMany>>) {
  return [...sources].sort((a, b) => {
    const aLastCrawled = a.lastCrawledAt?.getTime() ?? 0;
    const bLastCrawled = b.lastCrawledAt?.getTime() ?? 0;
    if (aLastCrawled !== bLastCrawled) return aLastCrawled - bLastCrawled;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.name.localeCompare(b.name);
  });
}

async function collectSourceItems(source: Awaited<ReturnType<typeof prisma.source.findFirstOrThrow>>) {
  if (source.sourceType === "rss_autodiscovery" && !source.resolvedFeedUrl) {
    const result = await discoverRss(source);
    if (!result.resolvedFeedUrl) throw new Error(result.error ?? "RSS discovery failed");
  }

  if (
    ["rss", "rss_autodiscovery", "steam_news_feed", "steam_app_rss", "youtube_channel_rss", "appstore_rss"].includes(source.sourceType)
  ) {
    return crawlRss(source.resolvedFeedUrl ?? source.url);
  }

  return crawlWebsite(source.url, source.sourceType);
}

async function crawlRss(url: string) {
  const feed = await parser.parseURL(url);
  return feed.items.map((item) => ({
    title: item.title ?? "Untitled article",
    url: item.link ?? url,
    publishedAt: item.isoDate ? new Date(item.isoDate) : item.pubDate ? new Date(item.pubDate) : null,
    rawContent: stripHtml(item.contentSnippet ?? item.content ?? item.summary ?? item.title ?? ""),
    summary: item.contentSnippet ?? null
  }));
}

async function crawlWebsite(url: string, sourceType: string) {
  const response = await fetch(url, { headers: crawlerHeaders() });
  if (!response.ok) {
    throw new Error(`Status code ${response.status}`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);
  return extractHtmlLinks($, url, sourceType).map((item) => ({
    title: item.title,
    url: item.url,
    publishedAt: null,
    rawContent: item.summary,
    summary: item.summary
  }));
}

function stripHtml(input: string) {
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
