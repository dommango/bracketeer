import { describe, it, expect } from "vitest";
import { encodeStripeForm } from "./stripe-encode";

describe("encodeStripeForm", () => {
  it("encodes flat scalar params", () => {
    expect(encodeStripeForm({ mode: "subscription", quantity: 1 })).toBe(
      "mode=subscription&quantity=1",
    );
  });

  // Brackets are percent-encoded (as Stripe's own SDKs do); Stripe decodes them
  // back to the nested shape server-side.
  it("encodes nested arrays of objects with bracket indices", () => {
    expect(encodeStripeForm({ line_items: [{ price: "price_1", quantity: 2 }] })).toBe(
      "line_items%5B0%5D%5Bprice%5D=price_1&line_items%5B0%5D%5Bquantity%5D=2",
    );
  });

  it("encodes nested objects (metadata)", () => {
    expect(encodeStripeForm({ subscription_data: { metadata: { poolId: "p1" } } })).toBe(
      "subscription_data%5Bmetadata%5D%5BpoolId%5D=p1",
    );
  });

  it("skips null and undefined values", () => {
    expect(encodeStripeForm({ a: "x", b: null, c: undefined })).toBe("a=x");
  });

  it("url-encodes keys and values", () => {
    expect(encodeStripeForm({ success_url: "https://x.io/p?ok=1&t=2" })).toBe(
      "success_url=https%3A%2F%2Fx.io%2Fp%3Fok%3D1%26t%3D2",
    );
  });
});
