export type CameraView = {
	/** The capture device the view is read from; null for a view fed by a video source the embedder supplies. */
	device: string | number | null;
	/** A raised panel floats above the row of the others. */
	raised?: boolean;
};

export type CameraViewsConfig = Record<string, CameraView>;

let currentConfig: CameraViewsConfig = {};
const handlers: ((config: CameraViewsConfig) => void)[] = [];

export function setCameraViewsConfig(config: CameraViewsConfig | null): void {
	currentConfig = config || {};
	console.log(
		"[CameraViews] setCameraViewsConfig called, keys:",
		Object.keys(currentConfig),
		"handlers:",
		handlers.length,
	);
	handlers.forEach((h, i) => {
		console.log("[CameraViews] Calling handler", i);
		try {
			h(currentConfig);
			console.log("[CameraViews] Handler", i, "completed");
		} catch (e) {
			console.error("[CameraViews] Handler", i, "threw error:", e);
		}
	});
	console.log("[CameraViews] All handlers completed");
}

export function getCameraViewsConfig(): CameraViewsConfig {
	return currentConfig;
}

export function isViewEnabled(key: string): boolean {
	return !!currentConfig[key];
}

export function onCameraViewsChanged(
	handler: (config: CameraViewsConfig) => void,
): void {
	handlers.push(handler);
	console.log("[CameraViews] Handler added, total handlers:", handlers.length);
	handler(currentConfig);
}
