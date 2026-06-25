import { Plus } from "lucide-react";
import { Shell } from "@/components/shell";
import { HelpModal } from "@/components/help-modal";
import { LoadingForm } from "@/components/loading-form";
import { RegisteredSourcesTable } from "@/components/registered-sources-table";
import { prisma } from "@/lib/prisma";
import { sourceTypes } from "@/lib/source-validation";

export default async function SourcesPage() {
  const sources = await prisma.source.findMany({ orderBy: { name: "asc" } });
  return (
    <Shell title="Source Manager" subtitle="Register RSS and website sources, then trigger manual crawls.">
      <section className="panel">
        <div className="section-heading">
          <h2>Add Source</h2>
          <HelpModal title="Add Source Fields" items={addSourceHelp} buttonLabel="Field Help" />
        </div>
        <LoadingForm className="form-grid" action="/api/sources" loadingLabel="Adding source">
          <label>
            Source name
            <input name="name" required placeholder="Gematsu" />
          </label>
          <label>
            Region
            <select name="region" defaultValue="global">
              <option value="korea">Korea</option>
              <option value="japan">Japan</option>
              <option value="north_america">North America</option>
              <option value="global">Global</option>
            </select>
          </label>
          <label>
            Language
            <select name="language" defaultValue="en">
              <option value="ko">Korean</option>
              <option value="ja">Japanese</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            Source type
            <select name="sourceType" defaultValue="rss">
              {sourceTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            URL
            <input name="url" required type="url" placeholder="https://example.com/feed" />
          </label>
          <label>
            Frequency hours
            <input name="crawlFrequencyHours" type="number" min="1" defaultValue="12" />
          </label>
          <label>
            Max items per run
            <input name="maxItemsPerRun" type="number" min="1" max="100" defaultValue="30" />
          </label>
          <label>
            Priority
            <input name="priority" type="number" min="1" max="5" defaultValue="3" />
          </label>
          <label>
            Reliability
            <select name="reliability" defaultValue="medium">
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label>
            Active
            <select name="active" defaultValue="true">
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
          <label>
            Notes
            <input name="notes" placeholder="Operational notes" />
          </label>
          <div className="form-actions">
            <button className="button" type="submit"><Plus size={16} /> Add Source</button>
          </div>
        </LoadingForm>
      </section>
      <section className="panel" style={{ marginTop: 16 }}>
        <div className="section-heading">
          <h2>Registered Sources</h2>
          <HelpModal title="Registered Sources Columns" items={registeredSourceHelp} buttonLabel="Table Help" />
        </div>
        <RegisteredSourcesTable sources={sources.map((source) => ({
          ...source,
          lastVerifiedAt: source.lastVerifiedAt?.toLocaleDateString() ?? "Never",
          lastCrawledAt: source.lastCrawledAt?.toLocaleDateString() ?? "Never",
          createdAt: undefined,
          updatedAt: undefined
        }))} />
      </section>
    </Shell>
  );
}

const addSourceHelp = [
  { label: "Source name", description: "Human-readable label shown in the Source Manager and crawl logs." },
  { label: "Region", description: "Primary market signal for the source. It is also used as a country fallback during lead analysis." },
  { label: "Language", description: "Main language expected from the feed or page. Used by keyword pre-filters." },
  { label: "Source type", description: "Parser mode, such as RSS, RSS auto-discovery, Steam, YouTube RSS, or HTML news list." },
  { label: "URL", description: "Original feed, website, Steam, YouTube, App Store, or Google Play URL to validate and crawl." },
  { label: "Frequency hours", description: "How often the source should be crawled when scheduled collection is enabled." },
  { label: "Max items per run", description: "Per-crawl cap to avoid collecting too many items from noisy sources." },
  { label: "Priority", description: "Lower numbers are processed first. Use 1 for high-value official or platform sources." },
  { label: "Reliability", description: "Manual trust rating. High is best for official or stable RSS sources; low is for noisy support sources." },
  { label: "Active", description: "Only active sources are included when Run Crawl is clicked." },
  { label: "Notes", description: "Operational comments, selector warnings, source caveats, or verification instructions." }
];

const registeredSourceHelp = [
  { label: "Source", description: "Source name plus original URL, resolved feed URL if discovered, and operational notes." },
  { label: "Region", description: "Market region used for filtering and country fallback in lead analysis." },
  { label: "Language", description: "Expected article language for keyword filtering and review context." },
  { label: "Type", description: "Current parser/source type used by validation and crawling." },
  { label: "Status", description: "Latest verification result: ok, warning, failed, or needs_review." },
  { label: "Priority", description: "Processing order. Smaller values are crawled and analyzed earlier." },
  { label: "Reliability", description: "Manual quality rating for the source." },
  { label: "Failures", description: "Consecutive verification or crawl failures. Sources may be deactivated after repeated failures." },
  { label: "Active", description: "Whether this source is included in normal crawl runs." },
  { label: "Last Verified", description: "Most recent source validation time." },
  { label: "Last Crawl", description: "Most recent successful crawl attempt for the source." },
  { label: "Verify", description: "Checks whether the source can be reached and parsed." },
  { label: "Discover RSS", description: "Attempts to find and save an RSS or Atom feed from the original webpage." },
  { label: "Crawl Now", description: "Runs a one-source crawl immediately." },
  { label: "Activate/Deactivate", description: "Toggles whether the source participates in normal crawl runs." }
];
