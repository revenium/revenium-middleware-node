import { mapAspectRatioToResolution } from "../../../src/google/utils";

describe("mapAspectRatioToResolution", () => {
  it.each([
    ["1:1", "1024x1024"],
    ["3:4", "768x1024"],
    ["4:3", "1024x768"],
    ["9:16", "576x1024"],
    ["16:9", "1024x576"],
  ])("maps %s to %s", (aspectRatio, expected) => {
    expect(mapAspectRatioToResolution(aspectRatio)).toBe(expected);
  });

  it("defaults to 1024x1024 when undefined", () => {
    expect(mapAspectRatioToResolution(undefined)).toBe("1024x1024");
  });

  it("defaults to 1024x1024 for unknown aspect ratio", () => {
    expect(mapAspectRatioToResolution("2:1")).toBe("1024x1024");
  });
});
