import { describe, expect, it } from "vitest";
import { analyzeArticleHeuristically } from "./analysis";

describe("analyzeArticleHeuristically", () => {
  it("includes a target pre-registration mobile lead", () => {
    const result = analyzeArticleHeuristically({
      title: "Korean developer opens global pre-registration for mobile RPG",
      url: "https://example.com/news",
      publishedAt: new Date(),
      rawContent: "The Korean developer announced pre-registration on Google Play and the App Store before global launch."
    });

    expect(result.is_relevant).toBe(true);
    expect(result.game.launch_stage).toBe("pre_registration");
    expect(result.opportunity.recommended_packages).toContain("Pre-Registration Marketing Package");
  });

  it("does not treat an in-word apostrophe as a game title quote", () => {
    const result = analyzeArticleHeuristically({
      title: "Sony reveals new pre-registration lineup",
      url: "https://example.com/state-of-play",
      publishedAt: new Date(),
      rawContent:
        'Sony\'s latest State of Play showcase revealed a series of new games and release dates, alongside the expected deep-dives on Marvel"s upcoming titles.'
    });

    expect(result.game.title).not.toMatch(/^s latest/);
    expect(result.game.title).toBe("Sony reveals new pre-registration lineup");
  });

  it("extracts a game title wrapped in Japanese quote brackets", () => {
    const result = analyzeArticleHeuristically({
      title: "新作モバイルRPGが事前登録を開始",
      url: "https://example.com/jp-news",
      publishedAt: new Date(),
      rawContent: "開発元は「ドラゴンズドグマ 2」の事前登録をApp StoreとGoogle Playで開始した。"
    });

    expect(result.game.title).toBe("ドラゴンズドグマ 2");
  });

  it("excludes post-launch review-only articles", () => {
    const result = analyzeArticleHeuristically({
      title: "Review: console-only game is out now",
      url: "https://example.com/review",
      publishedAt: new Date(),
      rawContent: "This review covers an already launched console-only packaged game with user reactions."
    });

    expect(result.is_relevant).toBe(false);
    expect(result.opportunity.grade).toBe("D");
  });
});
