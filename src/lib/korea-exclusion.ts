import type { Article, Company, Source } from "@prisma/client";

const koreanTextPattern = /[\uac00-\ud7af]|(?:\bkorea\b|\bkorean\b|\bsouth korea\b|\brepublic of korea\b|\bkr\b|한국|대한민국|韓国)/i;

export function isKoreanCountry(country?: string | null) {
  const normalized = country?.trim().toLowerCase();
  return Boolean(
    normalized &&
      ["korea", "south korea", "republic of korea", "republic of korea (south korea)", "kr", "kor", "한국", "대한민국"].includes(normalized)
  );
}

export function isKoreanCompany(company: Pick<Company, "country">) {
  return isKoreanCountry(company.country);
}

export function isKoreanSource(source: Pick<Source, "region" | "language" | "name" | "url">) {
  return source.region.toLowerCase() === "korea" || source.language.toLowerCase() === "ko" || koreanTextPattern.test(`${source.name} ${source.url}`);
}

export function isKoreanArticle(article: Pick<Article, "title" | "rawContent" | "summary"> & { source?: Pick<Source, "region" | "language" | "name" | "url"> | null }) {
  if (article.source && isKoreanSource(article.source)) return true;
  return koreanTextPattern.test(`${article.title} ${article.summary ?? ""} ${article.rawContent}`);
}

export const nonKoreanCompanyWhere = {
  NOT: [
    { country: { equals: "Korea" } },
    { country: { equals: "korea" } },
    { country: { equals: "South Korea" } },
    { country: { equals: "south korea" } },
    { country: { equals: "Republic of Korea" } },
    { country: { equals: "republic of korea" } },
    { country: { equals: "KR" } },
    { country: { equals: "kr" } },
    { country: { equals: "KOR" } }
  ]
};
