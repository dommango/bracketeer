import { describe, it, expect } from "vitest";
import { mapGiphyResults } from "./giphy";

describe("mapGiphyResults", () => {
  it("maps a realistic Giphy data array to GifResult[]", () => {
    const json = {
      data: [
        {
          id: "abc123",
          images: {
            fixed_width: { url: "https://media.giphy.com/fw.gif", width: "200", height: "150" },
            fixed_width_small: { url: "https://media.giphy.com/fws.gif", width: "100", height: "75" },
          },
        },
      ],
    };
    expect(mapGiphyResults(json)).toEqual([
      {
        id: "abc123",
        url: "https://media.giphy.com/fw.gif",
        previewUrl: "https://media.giphy.com/fws.gif",
        width: 200,
        height: 150,
      },
    ]);
  });

  it("falls back previewUrl to fixed_width url when small is missing", () => {
    const json = {
      data: [
        {
          id: "x",
          images: { fixed_width: { url: "https://g/fw.gif", width: 320, height: 240 } },
        },
      ],
    };
    const [r] = mapGiphyResults(json);
    expect(r.previewUrl).toBe("https://g/fw.gif");
    expect(r.width).toBe(320);
    expect(r.height).toBe(240);
  });

  it("drops entries missing a usable url", () => {
    const json = {
      data: [
        { id: "no-url", images: { fixed_width: { width: "200", height: "150" } } },
        { id: "no-images" },
        { id: "ok", images: { fixed_width: { url: "https://g/ok.gif", width: "10", height: "10" } } },
      ],
    };
    const results = mapGiphyResults(json);
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("https://g/ok.gif");
  });

  it("defaults width/height to 0 when unparseable", () => {
    const json = {
      data: [
        { id: "z", images: { fixed_width: { url: "https://g/z.gif", width: "nope", height: null } } },
      ],
    };
    const [r] = mapGiphyResults(json);
    expect(r.width).toBe(0);
    expect(r.height).toBe(0);
  });

  it("returns [] for malformed or empty input", () => {
    expect(mapGiphyResults(null)).toEqual([]);
    expect(mapGiphyResults(undefined)).toEqual([]);
    expect(mapGiphyResults({})).toEqual([]);
    expect(mapGiphyResults({ data: "not-an-array" })).toEqual([]);
    expect(mapGiphyResults({ data: [] })).toEqual([]);
  });
});
