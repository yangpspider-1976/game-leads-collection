import * as cheerio from "cheerio";
import type { Article, Company, Game, Source } from "@prisma/client";
import { prisma } from "./prisma";
import { crawlerHeaders } from "./source-validation";

type PageScan = {
  url: string;
  title?: string;
  description?: string;
  emails: string[];
  phones: string[];
  social: Partial<Record<SocialKey, string>>;
  contactFormUrl?: string;
  links: PageLink[];
};

type PageLink = {
  url: string;
  text: string;
};

type SearchCandidate = {
  title: string;
  url: string;
  snippet?: string;
  provider: string;
};

type WebsiteDiscovery = {
  url: string;
  provider: string;
  sourceUrl: string;
  phones: string[];
};

type EnrichmentContext = {
  article?: (Pick<Article, "url" | "rawContent" | "summary"> & { source?: Pick<Source, "url"> | null }) | null;
  game?: Pick<Game, "steamUrl" | "appStoreUrl" | "googlePlayUrl"> | null;
};

type SocialKey = "facebookUrl" | "instagramUrl" | "linkedinUrl" | "tiktokUrl" | "youtubeUrl" | "twitterUrl";

const socialHosts: Array<[SocialKey, RegExp]> = [
  ["facebookUrl", /(?:^|\.)facebook\.com$/i],
  ["instagramUrl", /(?:^|\.)instagram\.com$/i],
  ["linkedinUrl", /(?:^|\.)linkedin\.com$/i],
  ["tiktokUrl", /(?:^|\.)tiktok\.com$/i],
  ["youtubeUrl", /(?:^|\.)youtube\.com$|(?:^|\.)youtu\.be$/i],
  ["twitterUrl", /(?:^|\.)x\.com$|(?:^|\.)twitter\.com$/i]
];

const maxSecondaryContactItems = 5;

const nonOfficialWebsiteHosts = [
  /(?:^|\.)apps\.apple\.com$/i,
  /(?:^|\.)facebook\.com$/i,
  /(?:^|\.)instagram\.com$/i,
  /(?:^|\.)linkedin\.com$/i,
  /(?:^|\.)mobygames\.com$/i,
  /(?:^|\.)play\.google\.com$/i,
  /(?:^|\.)steam(?:powered|community)\.com$/i,
  /(?:^|\.)tiktok\.com$/i,
  /(?:^|\.)wikipedia\.org$/i,
  /(?:^|\.)x\.com$/i,
  /(?:^|\.)youtube\.com$/i
];

export async function enrichOpportunityLead(opportunityId: string) {
  const opportunity = await prisma.opportunity.findUniqueOrThrow({
    where: { id: opportunityId },
    include: { company: true, article: { include: { source: true } }, game: true }
  });

  return enrichCompany(opportunity.company, { article: opportunity.article, game: opportunity.game });
}

export async function enrichCompany(company: Company, context: EnrichmentContext = {}) {
  await prisma.company.update({
    where: { id: company.id },
    data: { enrichmentStatus: "processing", enrichmentError: null }
  });

  try {
    const discovery = company.website ? null : await discoverCompanyWebsite(company, context);
    const website = company.website ?? discovery?.url;

    if (!website) {
      const searchProviderMessage = hasSearchProvider()
        ? searchProviderDiscoveryEnabled()
          ? "No likely official website was found by web discovery."
          : "No likely official website was found from existing article/source URLs. Search-provider discovery is disabled to avoid credit use."
        : "No website URL is available and no search provider is configured. Add SERPER_API_KEY, SERPAPI_API_KEY, Google Custom Search keys, or BING_SEARCH_API_KEY.";
      return prisma.company.update({
        where: { id: company.id },
        data: {
          websiteStatus: "not_found",
          enrichmentStatus: "manual_review",
          enrichmentConfidence: 20,
          enrichmentError: searchProviderMessage,
          lastEnrichedAt: new Date()
        }
      });
    }

    const homepageUrl = normalizeWebsiteUrl(website);
    const homepage = await scanPage(homepageUrl);
    const candidateUrls = pickLikelyContactUrls(homepage, homepageUrl);
    const extraPages = [];
    for (const url of candidateUrls) {
      try {
        extraPages.push(await scanPage(url));
        await delay(Number(process.env.ENRICHMENT_REQUEST_DELAY_MS ?? 500));
      } catch {
        // Optional pages fail often; keep the homepage result instead of failing the whole enrichment.
      }
    }

    const pages = [homepage, ...extraPages];
    const emails = usefulEmails(unique(pages.flatMap((page) => page.emails)));
    const discoveredPhones = await discoverCompanyPhonesSafely(company);
    const phones = unique([...pages.flatMap((page) => page.phones), ...(discovery?.phones ?? []), ...discoveredPhones]).slice(
      0,
      maxSecondaryContactItems + 1
    );
    const social = mergeSocialLinks(pages);
    const contactPageUrl = bestContactPageUrl(extraPages) ?? company.contactUrl ?? null;
    const contactFormUrl = pages.find((page) => page.contactFormUrl)?.contactFormUrl ?? null;
    const sources = unique([...pages.map((page) => page.url), discovery?.sourceUrl]);
    const confidence = confidenceScore({
      websiteMatched: websiteMatchesCompany(homepage, company),
      hasEmail: emails.length > 0,
      hasPhone: phones.length > 0,
      hasSocial: Object.values(social).some(Boolean),
      hasContactPage: Boolean(contactPageUrl)
    });
    const status = confidence < 70 ? "manual_review" : emails.length > 0 || phones.length > 0 ? "completed" : "partial";

    return prisma.company.update({
      where: { id: company.id },
      data: {
        website: homepageUrl,
        websiteTitle: homepage.title ?? company.websiteTitle,
        websiteStatus: "found",
        contactUrl: contactPageUrl,
        contactFormUrl,
        contactEmail: company.enrichmentManuallyEdited && company.contactEmail ? company.contactEmail : emails[0] ?? company.contactEmail,
        secondaryEmails: JSON.stringify(emails.slice(1, maxSecondaryContactItems + 1)),
        contactPhone:
          company.enrichmentManuallyEdited && company.contactPhone && isLikelyPhoneNumber(company.contactPhone)
            ? company.contactPhone
            : phones[0] ?? company.contactPhone,
        secondaryPhones: JSON.stringify(phones.slice(1, maxSecondaryContactItems + 1)),
        facebookUrl: social.facebookUrl ?? company.facebookUrl,
        instagramUrl: social.instagramUrl ?? company.instagramUrl,
        linkedinUrl: social.linkedinUrl ?? company.linkedinUrl,
        tiktokUrl: social.tiktokUrl ?? company.tiktokUrl,
        youtubeUrl: social.youtubeUrl ?? company.youtubeUrl,
        twitterUrl: social.twitterUrl ?? company.twitterUrl,
        businessDescription: homepage.description ?? company.businessDescription,
        enrichmentStatus: status,
        enrichmentConfidence: confidence,
        enrichmentSources: JSON.stringify(sources),
        enrichmentError: status === "manual_review" ? "Confidence is below 70. Please review before outreach." : null,
        lastEnrichedAt: new Date()
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown enrichment error";
    await prisma.systemLog.create({
      data: {
        level: "warning",
        module: "lead-enrichment",
        message: `${company.name}: ${message}`,
        metadata: JSON.stringify({ companyId: company.id, website: company.website })
      }
    });
    return prisma.company.update({
      where: { id: company.id },
      data: {
        websiteStatus: "invalid",
        enrichmentStatus: "failed",
        enrichmentConfidence: 0,
        enrichmentError: message,
        lastEnrichedAt: new Date()
      }
    });
  }
}

function normalizeWebsiteUrl(value: string) {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

async function discoverCompanyWebsite(company: Company, context: EnrichmentContext = {}): Promise<WebsiteDiscovery | null> {
  const noCreditCandidate = await discoverCompanyWebsiteFromExistingUrls(company, context);
  if (noCreditCandidate) return noCreditCandidate;

  if (!searchProviderDiscoveryEnabled()) {
    return null;
  }

  const candidates = await searchWebsiteCandidates(company);
  return pickWebsiteFromCandidates(company, candidates);
}

async function discoverCompanyWebsiteFromExistingUrls(company: Company, context: EnrichmentContext): Promise<WebsiteDiscovery | null> {
  const candidates = await existingWebsiteCandidates(company, context);
  return pickWebsiteFromCandidates(company, candidates);
}

async function pickWebsiteFromCandidates(company: Company, candidates: SearchCandidate[]): Promise<WebsiteDiscovery | null> {
  for (const candidate of candidates.slice(0, Number(process.env.WEBSITE_DISCOVERY_MAX_CANDIDATES ?? 5))) {
    const homepageUrl = candidateToHomepage(candidate.url);
    if (!homepageUrl || isLikelyNonOfficialHost(homepageUrl)) continue;

    try {
      const page = await scanPage(homepageUrl);
      if (websiteLikelyMatchesCompany(page, company, candidate)) {
        return { url: homepageUrl, provider: candidate.provider, sourceUrl: candidate.url, phones: extractPhonesFromSearchText(candidate) };
      }
    } catch {
      if (candidateLikelyMatchesCompany(candidate, company)) {
        return { url: homepageUrl, provider: candidate.provider, sourceUrl: candidate.url, phones: extractPhonesFromSearchText(candidate) };
      }
    }
  }

  return null;
}

async function existingWebsiteCandidates(company: Company, context: EnrichmentContext): Promise<SearchCandidate[]> {
  const directLinks: PageLink[] = collectExistingLinks(context);
  const articleLinks = context.article?.url ? await linksFromKnownPage(context.article.url) : [];
  const likelyLinks = uniqueByUrl([...directLinks, ...articleLinks]).filter((link) => isLikelyOfficialLinkForCompany(link, company));

  return likelyLinks.map((link) => ({
    title: link.text,
    url: link.url,
    snippet: "Existing article/source URL",
    provider: "existing_urls"
  }));
}

function collectExistingLinks(context: EnrichmentContext) {
  const links: PageLink[] = [];
  const add = (value: string | null | undefined, text = "") => {
    if (!value) return;
    for (const url of extractHttpUrls(value)) {
      links.push({ url, text });
    }
  };

  add(context.article?.url, "Article URL");
  add(context.article?.source?.url, "Source URL");
  add(context.article?.summary, "Article summary");
  add(context.article?.rawContent, "Article content");
  add(context.game?.steamUrl, "Steam page");
  add(context.game?.appStoreUrl, "App Store page");
  add(context.game?.googlePlayUrl, "Google Play page");

  return links;
}

async function linksFromKnownPage(url: string) {
  try {
    const page = await scanPage(url);
    return page.links;
  } catch {
    return [];
  }
}

function isLikelyOfficialLinkForCompany(link: PageLink, company: Company) {
  const homepageUrl = candidateToHomepage(link.url);
  if (!homepageUrl || isLikelyNonOfficialHost(homepageUrl)) return false;
  return domainMatchesCompany(homepageUrl, company) || candidateLikelyMatchesCompany({ title: link.text, url: link.url, provider: "existing_urls" }, company);
}

async function discoverCompanyPhones(company: Company) {
  if (!phoneSearchDiscoveryEnabled()) return [];
  const candidates = await searchWebsiteCandidates({ ...company, name: `${company.name} contact phone number` });
  return unique(candidates.flatMap(extractPhonesFromSearchText)).slice(0, maxSecondaryContactItems + 1);
}

async function searchWebsiteCandidates(company: Company): Promise<SearchCandidate[]> {
  const query = `${company.name} ${company.country} game company official website`;
  const providerErrors: string[] = [];
  if (process.env.SERPER_API_KEY) {
    try {
      return await searchSerper(query, process.env.SERPER_API_KEY);
    } catch (error) {
      providerErrors.push(`Serper: ${errorMessage(error)}`);
    }
  }
  if (process.env.SERPAPI_API_KEY || process.env.SEARCH_API_KEY) {
    try {
      return await searchSerpApi(query, process.env.SERPAPI_API_KEY ?? process.env.SEARCH_API_KEY ?? "");
    } catch (error) {
      providerErrors.push(`SerpAPI: ${errorMessage(error)}`);
    }
  }
  if (process.env.GOOGLE_SEARCH_API_KEY && (process.env.GOOGLE_SEARCH_CX || process.env.GOOGLE_CSE_ID)) {
    try {
      return await searchGoogleCustom(query, process.env.GOOGLE_SEARCH_API_KEY, process.env.GOOGLE_SEARCH_CX ?? process.env.GOOGLE_CSE_ID ?? "");
    } catch (error) {
      providerErrors.push(`Google Custom Search: ${errorMessage(error)}`);
    }
  }
  if (process.env.BING_SEARCH_API_KEY) {
    try {
      return await searchBing(query, process.env.BING_SEARCH_API_KEY);
    } catch (error) {
      providerErrors.push(`Bing: ${errorMessage(error)}`);
    }
  }
  if (providerErrors.length > 0) {
    throw new Error(`Website discovery failed. ${providerErrors.join("; ")}`);
  }
  return [];
}

async function searchSerper(query: string, apiKey: string): Promise<SearchCandidate[]> {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey
    },
    body: JSON.stringify({ q: query, num: 8 }),
    signal: AbortSignal.timeout(Number(process.env.WEBSITE_DISCOVERY_TIMEOUT_MS ?? 10000))
  });
  if (!response.ok) throw new Error(await searchHttpError("Serper search", response));
  const data = (await response.json()) as { organic?: Array<{ title?: string; link?: string; snippet?: string }> };
  return (data.organic ?? [])
    .filter((item) => item.link)
    .map((item) => ({ title: item.title ?? "", url: item.link ?? "", snippet: item.snippet, provider: "serper" }));
}

async function searchSerpApi(query: string, apiKey: string): Promise<SearchCandidate[]> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("num", "8");
  const data = await fetchJson(url);
  const results = data as { organic_results?: Array<{ title?: string; link?: string; snippet?: string }> };
  return (results.organic_results ?? [])
    .filter((item) => item.link)
    .map((item) => ({ title: item.title ?? "", url: item.link ?? "", snippet: item.snippet, provider: "serpapi" }));
}

async function searchGoogleCustom(query: string, apiKey: string, cx: string): Promise<SearchCandidate[]> {
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("num", "8");
  const data = await fetchJson(url);
  const results = data as { items?: Array<{ title?: string; link?: string; snippet?: string }> };
  return (results.items ?? [])
    .filter((item) => item.link)
    .map((item) => ({ title: item.title ?? "", url: item.link ?? "", snippet: item.snippet, provider: "google_cse" }));
}

async function searchBing(query: string, apiKey: string): Promise<SearchCandidate[]> {
  const url = new URL("https://api.bing.microsoft.com/v7.0/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", "8");
  const data = await fetchJson(url, { "Ocp-Apim-Subscription-Key": apiKey });
  const results = data as { webPages?: { value?: Array<{ name?: string; url?: string; snippet?: string }> } };
  return (results.webPages?.value ?? [])
    .filter((item) => item.url)
    .map((item) => ({ title: item.name ?? "", url: item.url ?? "", snippet: item.snippet, provider: "bing" }));
}

async function fetchJson(url: URL, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    headers: { ...crawlerHeaders(), ...headers },
    signal: AbortSignal.timeout(Number(process.env.WEBSITE_DISCOVERY_TIMEOUT_MS ?? 10000))
  });
  if (!response.ok) throw new Error(await searchHttpError("Website discovery search", response));
  return response.json();
}

async function discoverCompanyPhonesSafely(company: Company) {
  try {
    return await discoverCompanyPhones(company);
  } catch (error) {
    await prisma.systemLog.create({
      data: {
        level: "warning",
        module: "lead-enrichment",
        message: `${company.name}: phone discovery skipped: ${errorMessage(error)}`,
        metadata: JSON.stringify({ companyId: company.id, website: company.website })
      }
    });
    return [];
  }
}

async function searchHttpError(label: string, response: Response) {
  const reason = await searchErrorReason(response);
  return `${label} returned HTTP ${response.status}${reason ? `: ${reason}` : ""}`;
}

async function searchErrorReason(response: Response) {
  try {
    const data = (await response.json()) as { message?: string; error?: string | { status?: string; message?: string } };
    if (typeof data.error === "string") return data.error;
    return data.message ?? data.error?.status ?? data.error?.message ?? null;
  } catch {
    return null;
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function hasSearchProvider() {
  return Boolean(
    process.env.SERPER_API_KEY ||
      process.env.SERPAPI_API_KEY ||
      process.env.SEARCH_API_KEY ||
      (process.env.GOOGLE_SEARCH_API_KEY && (process.env.GOOGLE_SEARCH_CX || process.env.GOOGLE_CSE_ID)) ||
      process.env.BING_SEARCH_API_KEY
  );
}

function searchProviderDiscoveryEnabled() {
  return process.env.ENRICHMENT_ALLOW_SEARCH_CREDITS === "true";
}

function phoneSearchDiscoveryEnabled() {
  return process.env.ENRICHMENT_ALLOW_PHONE_SEARCH_CREDITS === "true";
}

async function scanPage(url: string): Promise<PageScan> {
  const response = await fetch(url, {
    headers: crawlerHeaders(),
    signal: AbortSignal.timeout(Number(process.env.ENRICHMENT_TIMEOUT_MS ?? 10000))
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);

  const html = await response.text();
  const $ = cheerio.load(html);
  const text = $("body").text();
  const links = $("a[href]")
    .map((_, element) => {
      const linkUrl = safeUrl($(element).attr("href") ?? "", url);
      if (!linkUrl) return null;
      const text = [$(element).text(), $(element).attr("aria-label"), $(element).attr("title")]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      return { url: linkUrl, text };
    })
    .get()
    .filter(Boolean);
  const telPhones = $("a[href^='tel:']")
    .map((_, element) => ($(element).attr("href") ?? "").replace(/^tel:/i, ""))
    .get();

  return {
    url,
    title: $("title").first().text().trim() || undefined,
    description: $('meta[name="description"]').attr("content")?.trim(),
    emails: extractEmails(`${html} ${text}`),
    phones: unique([...telPhones, ...extractPhones(text)].map(cleanPhoneNumber)).filter(isLikelyPhoneNumber),
    social: extractSocialLinks(links.map((link) => link.url)),
    contactFormUrl: $("form").length ? url : undefined,
    links: unique(links)
  };
}

export function pickLikelyContactUrls(page: PageScan, homepageUrl: string) {
  const homepage = new URL(homepageUrl);
  const wanted = [/contact/i, /support/i, /inquir/i, /customer[ -]?service/i, /help/i, /about/i, /company/i];
  const links = page.links.filter((link) => {
    const parsed = new URL(link.url);
    const haystack = `${parsed.hostname} ${parsed.pathname} ${link.text}`;
    return isSameSite(parsed, homepage) && wanted.some((pattern) => pattern.test(haystack));
  });
  const fallbackPaths = ["/contact", "/contact.html", "/contact-us", "/contacts", "/support", "/about", "/about-us"];
  return uniqueByUrl([
    ...links,
    ...fallbackPaths.map((path) => ({ url: new URL(path, homepage.origin).toString(), text: "" })),
    ...firstPartyPressContactFallbacks(page.links, homepage)
  ])
    .sort((a, b) => contactLinkScore(b) - contactLinkScore(a))
    .map((link) => link.url)
    .slice(0, Number(process.env.ENRICHMENT_CONTACT_PAGE_LIMIT ?? 6));
}

export function bestContactPageUrl(pages: PageScan[]) {
  const scored = pages
    .map((page) => ({ page, score: contactPageScore(page) }))
    .filter(({ score }) => score >= 4)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.page.url;
}

function contactLinkScore(link: PageLink) {
  return contactUrlScore(link.url) + contactTextScore(link.text);
}

function contactPageScore(page: PageScan) {
  return contactUrlScore(page.url) + (page.contactFormUrl ? 3 : 0);
}

function contactUrlScore(url: string) {
  const parsed = new URL(url);
  const pathname = parsed.pathname.toLowerCase();
  const host = parsed.hostname.toLowerCase();
  if (/\/(?:contact|contact-us|contact-press|press-contact|contacts|contactus)(?:[-_/.]|\d|$)/.test(pathname)) return 8;
  if (/inquir|support|customer[-_]?service|help|press/.test(pathname)) return 6;
  if (/^(?:press|media|pr)\./.test(host)) return 3;
  if (/about/.test(pathname)) return 1;
  return 0;
}

function contactTextScore(text: string) {
  if (/contact|reach us|get in touch/i.test(text)) return 4;
  if (/inquir|support|customer[ -]?service|help/i.test(text)) return 3;
  if (/about|company/i.test(text)) return 1;
  return 0;
}

export function extractEmails(input: string) {
  return unique(input.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []).map((email) => email.toLowerCase());
}

export function extractHttpUrls(input: string) {
  const matches = input.match(/https?:\/\/[^\s<>"')\]]+/gi) ?? [];
  return unique(
    matches
      .map((url) => url.replace(/[.,;:!?]+$/g, ""))
      .filter((url) => {
        try {
          const parsed = new URL(url);
          return ["http:", "https:"].includes(parsed.protocol);
        } catch {
          return false;
        }
      })
  );
}

export function usefulEmails(emails: string[]) {
  return unique(emails.map((email) => email.toLowerCase())).filter(isUsefulEmail);
}

function isUsefulEmail(email: string) {
  const [localPart, domain] = email.toLowerCase().split("@");
  return (
    Boolean(localPart && domain) &&
    !/^(?:no-?reply|donotreply|test|example|admin)@/i.test(email) &&
    !/@example\./i.test(email) &&
    !isAssetEmailFalsePositive(localPart, domain)
  );
}

function isAssetEmailFalsePositive(localPart: string, domain: string) {
  const assetExtension = /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|webp|css|js|map|woff2?|ttf|otf|eot)$/i;
  return (
    assetExtension.test(domain) ||
    assetExtension.test(localPart) ||
    /(?:^|[-_.])2x(?:[-_.]|$)/i.test(domain) ||
    /(?:^|[-_.])2x(?:[-_.]|$)/i.test(localPart) ||
    /^[a-z0-9_-]+_map$/i.test(localPart) ||
    /(?:^|[-_.])(?:sprite|icon|logo|thumb|thumbnail|image|img)(?:[-_.]|$)/i.test(localPart)
  );
}

export function extractPhones(input: string) {
  const phoneLines = input
    .split(/\r?\n|[|•]/)
    .map((line) => line.trim())
    .filter((line) => line.length <= 240 && /phone|tel|telephone|call|contact|customer service|support/i.test(line));
  const matches = phoneLines.flatMap((line) => line.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) ?? []);
  return unique(
    matches
      .map(cleanPhoneNumber)
      .filter(isLikelyPhoneNumber)
  );
}

function extractPhonesFromSearchText(candidate: SearchCandidate) {
  return extractPhones(`${candidate.title}\n${candidate.snippet ?? ""}`);
}

function isLikelyPhoneNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const compact = phone.replace(/\s+/g, "");
  if (digits.length < 9 || digits.length > 15) return false;
  if (/(\d)\1{6,}/.test(digits)) return false;
  if (/^\d{13,}$/.test(compact)) return false;
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(compact)) return false;
  if (/^\d{1,2}-\d{1,2}-\d{1,2}(?:-\d{1,2})+$/.test(compact)) return false;
  if (/^(?:\d{1,4}[.-]){2,}\d{1,4}$/.test(compact) && !phone.startsWith("+")) return false;
  if (/^\d{2,4}-\d{4}-\d{2,4}$/.test(compact)) return false;
  if (/^\d{5,}-\d{1,4}$/.test(compact)) return false;
  if (/^0\s+0\b/.test(phone)) return false;
  if (/[.-]{2}|-\./.test(compact)) return false;
  if (!phone.startsWith("+") && (phone.match(/[.-]/g)?.length ?? 0) > 3) return false;
  if (!/[+\s().-]/.test(phone)) return false;
  if (!phone.startsWith("+") && !/[()\s]/.test(phone) && digits.length < 10) return false;
  return true;
}

function cleanPhoneNumber(phone: string) {
  return phone
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(\d{3}\))/, "($1");
}

function extractSocialLinks(links: string[]) {
  const social: Partial<Record<SocialKey, string>> = {};
  for (const link of links) {
    const host = new URL(link).hostname.replace(/^www\./i, "");
    const match = socialHosts.find(([, pattern]) => pattern.test(host));
    if (match && !social[match[0]]) social[match[0]] = link;
  }
  return social;
}

function mergeSocialLinks(pages: PageScan[]) {
  return pages.reduce<Partial<Record<SocialKey, string>>>((acc, page) => ({ ...page.social, ...acc }), {});
}

function websiteMatchesCompany(page: PageScan, company: Company) {
  const haystack = `${page.title ?? ""} ${page.description ?? ""}`.toLowerCase();
  return companyTokens(company).some((part) => haystack.includes(part));
}

function websiteLikelyMatchesCompany(page: PageScan, company: Company, candidate: SearchCandidate) {
  return websiteMatchesCompany(page, company) || candidateLikelyMatchesCompany(candidate, company) || domainMatchesCompany(page.url, company);
}

function candidateLikelyMatchesCompany(candidate: SearchCandidate, company: Company) {
  const haystack = `${candidate.title} ${candidate.snippet ?? ""}`.toLowerCase();
  return companyTokens(company).some((part) => haystack.includes(part)) || domainMatchesCompany(candidate.url, company);
}

function domainMatchesCompany(url: string, company: Company) {
  const host = new URL(url).hostname.replace(/^www\./i, "").split(".")[0].toLowerCase();
  return companyTokens(company).some((part) => host.includes(part.replaceAll("-", "")) || part.includes(host));
}

function companyTokens(company: Company) {
  return company.name
    .toLowerCase()
    .replace(/(?:inc|corp|corporation|co|company|ltd|limited|games|game|studio|studios|entertainment)\b/g, " ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((part) => part.length >= 3);
}

function candidateToHomepage(url: string) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function isLikelyNonOfficialHost(url: string) {
  const host = new URL(url).hostname.replace(/^www\./i, "");
  return nonOfficialWebsiteHosts.some((pattern) => pattern.test(host));
}

function confidenceScore(input: {
  websiteMatched: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
  hasSocial: boolean;
  hasContactPage: boolean;
}) {
  return Math.min(
    100,
    35 + (input.websiteMatched ? 20 : 0) + (input.hasEmail ? 20 : 0) + (input.hasPhone ? 15 : 0) + (input.hasSocial ? 5 : 0) + (input.hasContactPage ? 5 : 0)
  );
}

function safeUrl(href: string, baseUrl: string) {
  try {
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) return null;
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function unique<T>(values: T[]) {
  return [...new Set(values.filter(Boolean))] as T[];
}

function uniqueByUrl(links: PageLink[]) {
  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  });
}

function firstPartyPressContactFallbacks(links: PageLink[], homepage: URL) {
  const contactPaths = ["/contact-press/", "/contact/", "/contact.html"];
  const pressOrigins = unique(
    links
      .map((link) => new URL(link.url))
      .filter((parsed) => isSameSite(parsed, homepage))
      .filter((parsed) => /^(?:press|media|pr)\./i.test(parsed.hostname.replace(/^www\./i, "")) || /press|media|pr/i.test(parsed.pathname))
      .map((parsed) => parsed.origin)
  );

  return pressOrigins.flatMap((origin) => contactPaths.map((path) => ({ url: new URL(path, origin).toString(), text: "Press contact" })));
}

function isSameSite(candidate: URL, homepage: URL) {
  return siteDomain(candidate.hostname) === siteDomain(homepage.hostname);
}

function siteDomain(hostname: string) {
  const parts = hostname.replace(/^www\./i, "").toLowerCase().split(".");
  return parts.slice(-2).join(".");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
