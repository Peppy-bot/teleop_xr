import { describe, expect, it } from "vitest";

import { PANEL_SPACING, placeFloating, RAISED_HEIGHT } from "../panel_layout";

describe("placeFloating", () => {
	it("lays the row out side by side, centered, in key order", () => {
		expect(
			placeFloating({
				head: { device: 0 },
				chest: { device: 1 },
				wrist_left: { device: 2 },
			}),
		).toEqual([
			{ key: "chest", x: -PANEL_SPACING / 2, y: 0 },
			{ key: "head", x: PANEL_SPACING / 2, y: 0 },
		]);
	});

	it("floats a raised panel above the middle of the row", () => {
		expect(
			placeFloating({
				status: { device: null, raised: true },
				head: { device: 0 },
				chest: { device: 1 },
			}),
		).toEqual([
			{ key: "chest", x: -PANEL_SPACING / 2, y: 0 },
			{ key: "head", x: PANEL_SPACING / 2, y: 0 },
			{ key: "status", x: 0, y: RAISED_HEIGHT },
		]);
	});

	it("sits a raised panel at eye level with no row to clear", () => {
		expect(placeFloating({ status: { device: null, raised: true } })).toEqual([
			{ key: "status", x: 0, y: 0 },
		]);
	});

	it("places nothing from an empty config", () => {
		expect(placeFloating({})).toEqual([]);
	});
});
