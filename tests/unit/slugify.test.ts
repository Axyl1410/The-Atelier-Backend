import { describe, expect, it } from "vitest";
import { slugify } from "@/utils/slugify";

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("returns tag when input yields empty slug", () => {
    expect(slugify("???")).toBe("tag");
  });
});
