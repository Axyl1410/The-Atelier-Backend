import { InputValidationException } from "chanfana";
import { describe, expect, it } from "vitest";
import {
  decodeCommentListCursor,
  encodeCommentListCursor,
} from "@/lib/content/comment-cursor";

describe("comment list cursor", () => {
  it("roundtrips createdAt and id", () => {
    const payload = { createdAt: 1_704_000_000_000, id: "abc-uuid" };
    const encoded = encodeCommentListCursor(payload);
    expect(decodeCommentListCursor(encoded)).toEqual(payload);
  });

  it("rejects invalid cursor", () => {
    expect(() => decodeCommentListCursor("not-valid")).toThrow(
      InputValidationException
    );
  });
});

