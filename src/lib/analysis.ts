import crypto from "node:crypto";
import { z } from "zod";
import { conditionalStages, includedStages, qroadPackages } from "./constants";

const packageNameSchema = z.enum(qroadPackages);

export const aiAnalysisSchema = z.object({
  is_relevant: z.boolean(),
  relevance_reason: z.string(),
  exclusion_reason: z.string().nullable(),
  company: z.object({
    name: z.string(),
    country: z.enum(["Korea", "Japan", "USA", "Canada", "Unknown"]),
    company_type: z.enum([
      "developer",
      "publisher",
      "developer_publisher",
      "media",
      "platform",
      "investor",
      "unknown"
    ]),
    is_direct_service_owner: z.boolean()
  }),
  game: z.object({
    title: z.string(),
    platforms: z.array(z.string()),
    genre: z.string(),
    launch_stage: z.string(),
    expected_launch_date: z.string().nullable()
  }),
  opportunity: z.object({
    opportunity_type: z.string(),
    is_pre_launch_or_new_launch: z.boolean(),
    recommended_packages: z.array(packageNameSchema),
    score: z.number().int(),
    grade: z.enum(["A", "B", "C", "D"]),
    next_action: z.string()
  }),
  evidence: z.object({
    key_quotes: z.array(z.string()),
    detected_keywords: z.array(z.string())
  }),
  uncertainty: z.string().nullable()
});

export type AiAnalysis = z.infer<typeof aiAnalysisSchema>;

export function contentHash(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function gradeFromScore(score: number) {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

export function matchPackages(text: string) {
  const lower = text.toLowerCase();
  const packages = new Set<string>();

  if (/(closed beta|cbt|open beta|obt|playtest|early access|before launch|upcoming|オープンβ|クローズドβ|βテスト|体験版|デモ|사전예약|비공개 테스트|공개 테스트|출시 예정)/.test(lower)) {
    packages.add("Pre-Launch QA Package");
  }
  if (/(app store|google play|steam page|wishlist|pre-register|pre-order|payment|store|steam|ストアページ|ウィッシュリスト|구글 플레이|앱스토어|스팀|위시리스트)/.test(lower)) {
    packages.add("Store & Platform QA Package");
  }
  if (/(global|worldwide|north america|japan|korea|english|japanese|korean|locali[sz]ation|グローバル|世界|日本|韓国|북미|글로벌|일본|한국)/.test(lower)) {
    packages.add("Global Launch Localization Package");
  }
  if (/(soft launch|launch operation|community|customer support|24h|monitoring|large-scale beta)/.test(lower)) {
    packages.add("Launch Operation Support Package");
  }
  if (/(pre-registration|pre-register|wishlist|campaign|trailer|kol|influencer|事前登録|キャンペーン|トレイラー|사전예약|캠페인|트레일러)/.test(lower)) {
    packages.add("Pre-Registration Marketing Package");
  }
  if (/(trailer|creative|banner|store image|video|motion graphic|ad creative)/.test(lower)) {
    packages.add("Game Creative Production Package");
  }
  if (/(discord|reddit|steam community|sentiment|ai|harmful|comment monitoring)/.test(lower)) {
    packages.add("AI Community & CS Monitoring Package");
  }

  return Array.from(packages);
}

export function classifyLaunchStage(text: string) {
  const lower = text.toLowerCase();
  if (/(closed beta|cbt|クローズドβ|비공개 테스트)/.test(lower)) return "cbt_scheduled";
  if (/(open beta|obt|public beta|オープンβ|공개 테스트)/.test(lower)) return "obt_scheduled";
  if (/soft launch|limited launch|regional test|소프트런칭/.test(lower)) return "soft_launch_scheduled";
  if (/pre-registration|pre-register|pre order|pre-order|事前登録|사전예약/.test(lower)) return "pre_registration";
  if (/wishlist|ウィッシュリスト|위시리스트/.test(lower)) return "steam_wishlist";
  if (/playtest|next fest|プレイテスト/.test(lower)) return "steam_playtest";
  if (/early access|早期アクセス|얼리 액세스/.test(lower)) return "early_access_scheduled";
  if (/global launch|worldwide release|グローバル.*(配信|発売|リリース)|글로벌.*출시/.test(lower)) return "global_launch_scheduled";
  if (/(north america|japan|korea).{0,40}launch|launch.{0,40}(north america|japan|korea)/.test(lower)) {
    return "regional_launch_scheduled";
  }
  if (/(steam|mobile|ios|android).{0,40}release|coming to (steam|mobile|ios|android)/.test(lower)) {
    return "platform_expansion_scheduled";
  }
  if (/relaunch|reboot|new version/.test(lower)) return "relaunch_scheduled";
  if (/expansion|major dlc|new season/.test(lower)) return "expansion_pack_scheduled";
  if (/launch scheduled|release date|coming soon|upcoming|発売予定|配信予定|リリース予定|출시 예정/.test(lower)) return "launch_scheduled";
  if (/now available|out now|launched today|本日発売|配信開始|정식 출시|출시했다/.test(lower)) return "already_launched";
  if (/review|impressions|top grossing|ranking|レビュー|ランキング|리뷰|순위|매출/.test(lower)) return "post_launch_only";
  if (/announces|reveals|unveils|new title|発表|公開|신작 공개|발표/.test(lower)) return "pre_announcement";
  if (/in development|developing/.test(lower)) return "in_development";
  return "unknown";
}

export function analyzeArticleHeuristically(article: {
  title: string;
  rawContent: string;
  publishedAt?: Date | null;
  url: string;
  source?: {
    name?: string;
    region?: string;
    language?: string;
  };
}): AiAnalysis {
  const text = `${article.title}\n${article.rawContent}`;
  const lower = text.toLowerCase();
  const packages = matchPackages(text);
  const launchStage = classifyLaunchStage(text);
  const platforms = [
    /steam/.test(lower) ? "steam" : null,
    /(ios|app store)/.test(lower) ? "ios" : null,
    /(android|google play)/.test(lower) ? "android" : null,
    /mobile/.test(lower) ? "mobile" : null
  ].filter(Boolean) as string[];
  const country = /korea|korean|한국|韓国/.test(lower)
    ? "Korea"
    : /japan|japanese|日本|일본/.test(lower)
      ? "Japan"
      : /canada|canadian/.test(lower)
        ? "Canada"
        : /(north america|usa|united states|american)/.test(lower)
          ? "USA"
          : countryFromSourceRegion(article.source?.region);
  const companyType = /(developer|studio|개발사|開発)/.test(lower)
    ? "developer"
    : /publisher|퍼블리셔|配信元|発売元|パブリッシャ/.test(lower)
      ? "publisher"
      : "unknown";

  let score = 0;
  if (country !== "Unknown") score += 20;
  if (companyType !== "unknown") score += 20;
  if (platforms.length > 0) score += 20;
  if (includedStages.has(launchStage)) score += 25;
  if (/global|worldwide|multi-country|north america|japan|korea/.test(lower)) score += 20;
  if (/(closed beta|cbt|open beta|obt|soft launch)/.test(lower)) score += 15;
  if (/(pre-registration|pre-register|wishlist)/.test(lower)) score += 15;
  if (packages.length >= 3) score += 15;
  if (/contact|press@|support@/.test(lower)) score += 10;
  if (article.url) score += 10;
  if (article.publishedAt && Date.now() - article.publishedAt.getTime() <= 30 * 24 * 60 * 60 * 1000) score += 10;
  if (launchStage === "already_launched" || launchStage === "post_launch_only") score -= 50;
  if (/(review|rumor|leak|reportedly|reaction)/.test(lower)) score -= 30;
  if (/console-only|playstation|xbox|switch/.test(lower) && platforms.length === 0) score -= 20;
  if (launchStage === "unknown") score -= 10;
  if (companyType === "unknown") score -= 10;

  const isIncluded = includedStages.has(launchStage) || conditionalStages.has(launchStage);
  const isRelevant =
    country !== "Unknown" &&
    ["developer", "publisher"].includes(companyType) &&
    platforms.length > 0 &&
    packages.length > 0 &&
    isIncluded;

  return {
    is_relevant: isRelevant,
    relevance_reason: isRelevant
      ? "Article matches target region, platform, launch timing, and at least one QROAD package."
      : "Article is incomplete or outside the target lead criteria.",
    exclusion_reason: isRelevant ? null : "Failed one or more required pass conditions.",
    company: {
      name: extractCompanyNameFromTitle(article.title) ?? "Needs research",
      country,
      company_type: companyType,
      is_direct_service_owner: companyType !== "unknown"
    },
    game: {
      title: extractGameTitleFromText(article.title) ?? extractGameTitleFromText(article.rawContent) ?? article.title.split(" for ")[0].slice(0, 80),
      platforms,
      genre: /rpg/.test(lower) ? "RPG" : "unknown",
      launch_stage: launchStage,
      expected_launch_date: null
    },
    opportunity: {
      opportunity_type: launchStage.replace("_scheduled", "").replace("steam_", "steam_"),
      is_pre_launch_or_new_launch: isIncluded,
      recommended_packages: packages as AiAnalysis["opportunity"]["recommended_packages"],
      score: Math.max(0, Math.min(100, score)),
      grade: gradeFromScore(Math.max(0, Math.min(100, score))),
      next_action:
        score >= 60 ? "Review contact information and personalize outreach draft." : "Monitor until launch timing and ownership are clearer."
    },
    evidence: {
      key_quotes: buildEnglishEvidencePoints({
        title: article.title,
        companyName: extractCompanyNameFromTitle(article.title) ?? "Needs research",
        gameTitle: extractGameTitleFromText(article.title) ?? extractGameTitleFromText(article.rawContent) ?? article.title.split(" for ")[0].slice(0, 80),
        launchStage,
        platforms,
        packages,
        score: Math.max(0, Math.min(100, score)),
        isRelevant
      }),
      detected_keywords: Array.from(new Set((text.match(/Steam|mobile|pre-registration|CBT|OBT|soft launch|global|wishlist|launch/gi) ?? []).slice(0, 8)))
    },
    uncertainty: isRelevant ? null : "Heuristic analysis could not confirm all required fields."
  };
}

function buildEnglishEvidencePoints(input: {
  title: string;
  companyName: string;
  gameTitle: string;
  launchStage: string;
  platforms: string[];
  packages: string[];
  score: number;
  isRelevant: boolean;
}) {
  const points = [
    `Article reviewed: ${input.title}`,
    `Detected company/game: ${input.companyName} / ${input.gameTitle}.`,
    `Detected launch stage: ${input.launchStage.replaceAll("_", " ")}.`,
    input.platforms.length ? `Detected platforms: ${input.platforms.join(", ")}.` : "No target platform was confidently detected.",
    input.packages.length ? `Matched QROAD packages: ${input.packages.join(", ")}.` : "No QROAD service package was confidently matched.",
    `Lead assessment: ${input.isRelevant ? "target lead" : "needs research"} with score ${input.score}.`
  ];

  return points;
}

function extractEntityName(title: string) {
  return title.match(/^([A-Z][A-Za-z0-9 .&-]{2,40})\s+(announces|reveals|opens|starts|plans|recruits)/)?.[1] ?? null;
}

export function countryFromSourceRegion(region?: string): AiAnalysis["company"]["country"] {
  if (region === "korea") return "Korea";
  if (region === "japan") return "Japan";
  if (region === "north_america") return "USA";
  return "Unknown";
}

// Paired quote delimiters that reliably wrap a title. Straight/curly apostrophes are
// intentionally excluded: an in-word apostrophe (e.g. "Sony's") would otherwise be read
// as an opening quote and capture the rest of the sentence as a bogus game title.
const gameTitleQuotePairs: Array<[string, string]> = [
  ['"', '"'],
  ["“", "”"],
  ["「", "」"],
  ["『", "』"]
];

function escapeRegExpLiteral(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeGameTitleCandidate(candidate?: string | null) {
  if (!candidate) return null;
  const value = candidate.trim();
  if (value.length < 2 || value.length > 80) return null;
  // Prose fragments captured after an in-word apostrophe start mid-sentence (lowercase);
  // real titles begin with an uppercase letter, digit, or a non-Latin character.
  if (/^[a-z]/.test(value)) return null;
  if (value.split(/\s+/).length > 12) return null;
  // Reject sentence-like text containing internal sentence punctuation.
  if (/[.!?。！？]\s/.test(value)) return null;
  return value;
}

function extractGameTitleFromText(text: string) {
  for (const [open, close] of gameTitleQuotePairs) {
    const excludedChars = open === close ? escapeRegExpLiteral(close) : `${escapeRegExpLiteral(open)}${escapeRegExpLiteral(close)}`;
    const pattern = new RegExp(`${escapeRegExpLiteral(open)}([^${excludedChars}]{2,80}?)${escapeRegExpLiteral(close)}`);
    const candidate = sanitizeGameTitleCandidate(text.match(pattern)?.[1]);
    if (candidate) return candidate;
  }
  return null;
}

export function extractCompanyNameFromTitle(title: string) {
  const cleaned = title.replace(/\s+-\s+[^-]+$/, "").trim();
  const candidates = [
    cleaned.match(/^([A-Z][A-Za-z0-9&.-]{1,30}(?:\s+(?:Games|Studios|Studio|Inc|Co|Corp|Corporation|Entertainment|Interactive|Ltd|LLC))?)\s+(?:has\s+officially\s+)?(?:announces|announced|reveals|revealed|opens|opened|starts|started|plans|recruits|launches|publishes)\b/)?.[1],
    cleaned.match(/^([가-힣A-Za-z0-9・&.]{2,20})[,，]\s*[‘'“"「]/)?.[1],
    cleaned.match(/^([가-힣A-Za-z0-9・&.]{2,20})\s+[‘'“"「][^’'”"」]+[’'”"」]\s*(?:글로벌|국내|북미|일본|사전|출시|공개|모집|시작|CBT|OBT)/)?.[1],
    cleaned.match(/^([ァ-ヶー一-龠A-Za-z0-9・&.]{2,24})[,，]\s*[「『]/)?.[1]
  ];

  return candidates.map((candidate) => sanitizeCompanyCandidate(candidate)).find(Boolean) ?? null;
}

function sanitizeCompanyCandidate(candidate?: string) {
  if (!candidate) return null;
  const value = candidate.trim();
  if (value.length < 2 || value.length > 40) return null;
  if (/\s{2,}/.test(value)) return null;
  if (/[.!?。！？]/.test(value)) return null;
  if (/(officially|article|review|trailer|video|뉴스|게임|출시|공개|모집|조회수|영상|公式|動画|発売|配信|公開)/i.test(value)) return null;
  if (value.split(/\s+/).length > 4) return null;
  return value;
}
