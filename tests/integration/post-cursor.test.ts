import { InputValidationException } from "chanfana";
import { describe, expect, it } from "vitest";
import {
  decodePostListCursor,
  encodePostListCursor,
} from "@/lib/content/post-cursor";

describe("post list cursor", () => {
  it("roundtrips createdAt and id", () => {
    const payload = { createdAt: 1_704_000_000_000, id: "abc-uuid" };
    const encoded = encodePostListCursor(payload);
    expect(decodePostListCursor(encoded)).toEqual(payload);
  });

  it("rejects invalid cursor", () => {
    expect(() => decodePostListCursor("not-valid")).toThrow(
      InputValidationException
    );
  });
});
