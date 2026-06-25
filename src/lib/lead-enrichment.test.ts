import { describe, expect, it } from "vitest";
import { bestContactPageUrl, extractEmails, extractHttpUrls, extractPhones, pickLikelyContactUrls, usefulEmails } from "./lead-enrichment";

describe("lead enrichment contact scanning", () => {
  it("prefers explicit contact links over about pages", () => {
    const urls = pickLikelyContactUrls(
      {
        url: "https://505games.com",
        emails: [],
        phones: [],
        social: {},
        links: [
          { url: "https://505games.com/about-2/", text: "About" },
          { url: "https://505games.com/contact-us/", text: "Contact Us" }
        ]
      },
      "https://505games.com"
    );

    expect(urls[0]).toBe("https://505games.com/contact-us/");
  });

  it("keeps contact html pages ahead of guessed fallback paths", () => {
    const urls = pickLikelyContactUrls(
      {
        url: "https://www.neteasegames.com",
        emails: [],
        phones: [],
        social: {},
        links: [
          { url: "https://www.neteasegames.com/games.html", text: "Games" },
          { url: "https://www.neteasegames.com/business.html", text: "Business" },
          { url: "https://www.neteasegames.com/contact.html", text: "Contact" }
        ]
      },
      "https://www.neteasegames.com"
    );

    expect(urls[0]).toBe("https://www.neteasegames.com/contact.html");
  });

  it("includes first-party press subdomain contact pages", () => {
    const urls = pickLikelyContactUrls(
      {
        url: "https://dearvillagers.com",
        emails: [],
        phones: [],
        social: {},
        links: [
          { url: "https://press.dearvillagers.com/", text: "Press kit" },
          { url: "https://dearvillagers.com/games", text: "Games" }
        ]
      },
      "https://dearvillagers.com"
    );

    expect(urls).toContain("https://press.dearvillagers.com/contact-press/");
  });

  it("stores first-party press contact pages as contact pages", () => {
    const contactPage = bestContactPageUrl([
      {
        url: "https://press.dearvillagers.com/contact-press/",
        emails: ["press@example.com"],
        phones: [],
        social: {},
        links: []
      }
    ]);

    expect(contactPage).toBe("https://press.dearvillagers.com/contact-press/");
  });

  it("does not store a generic about page as the contact page", () => {
    const contactPage = bestContactPageUrl([
      {
        url: "https://505games.com/about-2/",
        emails: [],
        phones: ["(818) 540-3000"],
        social: {},
        links: []
      }
    ]);

    expect(contactPage).toBeUndefined();
  });

  it("stores contact html pages as contact pages", () => {
    const contactPage = bestContactPageUrl([
      {
        url: "https://www.neteasegames.com/contact.html",
        emails: ["neteasegamespr@global.netease.com"],
        phones: [],
        social: {},
        links: []
      }
    ]);

    expect(contactPage).toBe("https://www.neteasegames.com/contact.html");
  });

  it("repairs a missing opening parenthesis on US-style phone numbers", () => {
    expect(extractPhones("Phone: 818) 540-3000")).toEqual(["(818) 540-3000"]);
  });

  it("filters image asset filenames that look like email addresses", () => {
    const emails = extractEmails(
      "contact@ctw.inc tokyo@2x.env5vyou.jpg tokyo_map@2x.cliyt8ht.png taipei@2x.dnpiu-vp.jpg shanghai@2x.rrzhlevc.jpg"
    );

    expect(usefulEmails(emails)).toEqual(["contact@ctw.inc"]);
  });

  it("extracts existing article URLs without trailing punctuation", () => {
    expect(extractHttpUrls("Official site: https://samplestudio.example.com/contact. Steam: https://store.steampowered.com/app/12345)")).toEqual([
      "https://samplestudio.example.com/contact",
      "https://store.steampowered.com/app/12345"
    ]);
  });
});
