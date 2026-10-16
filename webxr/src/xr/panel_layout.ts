import type { CameraViewsConfig } from "./camera_views";

/** The views attached to a controller, outside the floating row. */
export const WRIST_VIEWS = ["wrist_left", "wrist_right"];
/** Meters between the centers of neighboring panels of the row. */
export const PANEL_SPACING = 0.9;
/**
 * Meters a raised panel floats above the row. A panel's top sits 0.645 m
 * above its handle's center (0.6 m of panel over a 0.05 m handle and a
 * 0.02 m gap), so the raised one's handle clears the row by 3 cm.
 */
export const RAISED_HEIGHT = 0.7;

export type PanelPlace = { key: string; x: number; y: number };

/**
 * Where each floating panel of `config` sits, relative to the wearer: the
 * row's panels side by side, centered, in key order; a raised panel above
 * the row's middle, or at eye level with no row to clear.
 */
export function placeFloating(config: CameraViewsConfig): PanelPlace[] {
	const floating = Object.keys(config)
		.filter((key) => !WRIST_VIEWS.includes(key))
		.sort();
	const row = floating.filter((key) => !config[key].raised);
	const startX = (-(row.length - 1) * PANEL_SPACING) / 2;
	return floating.map((key) =>
		config[key].raised
			? { key, x: 0, y: row.length > 0 ? RAISED_HEIGHT : 0 }
			: { key, x: startX + row.indexOf(key) * PANEL_SPACING, y: 0 },
	);
}
