import {
	type CameraViewsConfig,
	setCameraViewsConfig,
} from "../xr/camera_views";
import { useAppStore } from "./store";

/** The route serving the settings the socket sends at connect. */
export const CONFIG_PATH = "/config";

export type ServerConfig = {
	camera_views?: CameraViewsConfig | null;
};

/** List `cameraViews` as the page's camera feeds and the session's panels. */
export function applyCameraViews(
	cameraViews: CameraViewsConfig | null | undefined,
): void {
	const views = cameraViews ?? null;
	useAppStore.getState().setAvailableCameras(views ? Object.keys(views) : []);
	setCameraViewsConfig(views);
}

/**
 * Read the server's config and apply its camera views, so the page lists
 * them before a session opens the socket. Throws when the server does not
 * answer with one.
 */
export async function loadServerConfig(
	fetchFn: typeof fetch = fetch,
): Promise<void> {
	const response = await fetchFn(CONFIG_PATH);
	if (!response.ok) {
		throw new Error(`${CONFIG_PATH} answered ${response.status}`);
	}
	const config = (await response.json()) as ServerConfig;
	applyCameraViews(config.camera_views);
}
