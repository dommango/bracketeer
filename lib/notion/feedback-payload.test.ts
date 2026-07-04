import { describe, it, expect } from "vitest";
import { buildFeedbackNotionPayload } from "./feedback-payload";

const DB = "db-123";

describe("buildFeedbackNotionPayload", () => {
  it("maps the parent database id from the caller", () => {
    const body = buildFeedbackNotionPayload(
      { id: "r1", type: "BUG", title: "x", environment: "Production" },
      DB,
    );
    expect(body.parent).toEqual({ database_id: DB });
  });

  it("maps BUG → Bug with a 🐛 emoji title + icon", () => {
    const body = buildFeedbackNotionPayload(
      { id: "r1", type: "BUG", title: "Broken", environment: "Production" },
      DB,
    );
    expect(body.properties.Type.select.name).toBe("Bug");
    expect(body.icon).toEqual({ type: "emoji", emoji: "🐛" });
    expect(body.properties.Title.title[0].text.content).toBe("🐛 Broken");
  });

  it("maps IDEA → Request with a ✨ emoji", () => {
    const body = buildFeedbackNotionPayload(
      { id: "r1", type: "IDEA", title: "Add dark mode", environment: "Development" },
      DB,
    );
    expect(body.properties.Type.select.name).toBe("Request");
    expect(body.icon.emoji).toBe("✨");
    expect(body.properties.Title.title[0].text.content).toBe("✨ Add dark mode");
  });

  it("maps OTHER → Feedback with a 💬 emoji", () => {
    const body = buildFeedbackNotionPayload(
      { id: "r1", type: "OTHER", title: "Nice app", environment: "Production" },
      DB,
    );
    expect(body.properties.Type.select.name).toBe("Feedback");
    expect(body.icon.emoji).toBe("💬");
    expect(body.properties.Title.title[0].text.content).toBe("💬 Nice app");
  });

  it("always sets App=HessFest and Status=New", () => {
    const body = buildFeedbackNotionPayload(
      { id: "r1", type: "BUG", title: "x", environment: "Production" },
      DB,
    );
    expect(body.properties.App.select.name).toBe("HessFest");
    expect(body.properties.Status.select.name).toBe("New");
  });

  it("passes Environment through from the caller", () => {
    const prod = buildFeedbackNotionPayload(
      { id: "r1", type: "BUG", title: "x", environment: "Production" },
      DB,
    );
    const dev = buildFeedbackNotionPayload(
      { id: "r1", type: "BUG", title: "x", environment: "Development" },
      DB,
    );
    expect(prod.properties.Environment.select.name).toBe("Production");
    expect(dev.properties.Environment.select.name).toBe("Development");
  });

  it("writes the row id into App Row ID (the idempotency key)", () => {
    const body = buildFeedbackNotionPayload(
      { id: "row-abc", type: "BUG", title: "x", environment: "Production" },
      DB,
    );
    expect(body.properties["App Row ID"].rich_text[0].text.content).toBe("row-abc");
  });

  it("omits Page URL / User Email / Browser when absent", () => {
    const body = buildFeedbackNotionPayload(
      { id: "r1", type: "BUG", title: "x", environment: "Production" },
      DB,
    );
    expect(body.properties["Page URL"]).toBeUndefined();
    expect(body.properties["User Email"]).toBeUndefined();
    expect(body.properties.Browser).toBeUndefined();
    expect(body.properties.Screenshot).toBeUndefined();
  });

  it("includes Page URL / User Email / Browser when present", () => {
    const body = buildFeedbackNotionPayload(
      {
        id: "r1",
        type: "BUG",
        title: "x",
        pageUrl: "https://ex.com/p",
        userEmail: "a@b.com",
        userAgent: "Mozilla/5.0",
        environment: "Production",
      },
      DB,
    );
    expect(body.properties["Page URL"].url).toBe("https://ex.com/p");
    expect(body.properties["User Email"].email).toBe("a@b.com");
    expect(body.properties.Browser.rich_text[0].text.content).toBe("Mozilla/5.0");
  });

  it("truncates a long Browser userAgent to ~200 chars", () => {
    const ua = "U".repeat(500);
    const body = buildFeedbackNotionPayload(
      { id: "r1", type: "BUG", title: "x", userAgent: ua, environment: "Production" },
      DB,
    );
    expect(body.properties.Browser.rich_text[0].text.content.length).toBe(200);
  });

  it("maps screenshot URLs to external files and inline image blocks", () => {
    const urls = ["https://ex.com/s/0", "https://ex.com/s/1"];
    const body = buildFeedbackNotionPayload(
      { id: "r1", type: "BUG", title: "x", screenshotUrls: urls, environment: "Production" },
      DB,
    );
    expect(body.properties.Screenshot.files).toHaveLength(2);
    expect(body.properties.Screenshot.files[0].external.url).toBe(urls[0]);
    const imageBlocks = body.children.filter((b) => b.type === "image");
    expect(imageBlocks).toHaveLength(2);
    expect(imageBlocks[0].image.external.url).toBe(urls[0]);
  });

  it("adds a description paragraph block (sliced to 2000) when present", () => {
    const body = buildFeedbackNotionPayload(
      { id: "r1", type: "BUG", title: "x", description: "hello", environment: "Production" },
      DB,
    );
    const paras = body.children.filter((b) => b.type === "paragraph");
    expect(paras).toHaveLength(1);
    expect(paras[0].paragraph.rich_text[0].text.content).toBe("hello");
  });

  it("has no children when there is no description and no screenshots", () => {
    const body = buildFeedbackNotionPayload(
      { id: "r1", type: "BUG", title: "x", environment: "Production" },
      DB,
    );
    expect(body.children).toHaveLength(0);
  });
});
