import { beforeEach, describe, expect, it } from "vitest";

import {
	applyCameraViews,
	CONFIG_PATH,
	loadServerConfig,
} from "../lib/server_config";
import { useAppStore } from "../lib/store";
import { getCameraViewsConfig } from "../xr/camera_views";

const answer = (status: number, body: unknown) =>
	({
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
	}) as Response;

const answering = (status: number, body: unknown) =>
	(async () => answer(status, body)) as unknown as typeof fetch;

describe("server config", () => {
	beforeEach(() => {
		applyCameraViews(null);
	});

	it("lists the camera views as the feeds and the panels", () => {
		applyCameraViews({ head: { device: 0 }, status: { device: null } });

		expect(useAppStore.getState().availableCameras).toEqual(["head", "status"]);
		expect(getCameraViewsConfig()).toEqual({
			head: { device: 0 },
			status: { device: null },
		});
	});

	it("clears both with no views", () => {
		applyCameraViews({ head: { device: 0 } });
		applyCameraViews(undefined);

		expect(useAppStore.getState().availableCameras).toEqual([]);
		expect(getCameraViewsConfig()).toEqual({});
	});

	it("loads the views from the config route", async () => {
		const asked: string[] = [];
		const fetchFn = (async (path: string) => {
			asked.push(path);
			return answer(200, { camera_views: { chest: { device: 1 } } });
		}) as unknown as typeof fetch;

		await loadServerConfig(fetchFn);

		expect(asked).toEqual([CONFIG_PATH]);
		expect(useAppStore.getState().availableCameras).toEqual(["chest"]);
	});

	it("throws, changing nothing, when the route answers without a config", async () => {
		applyCameraViews({ head: { device: 0 } });

		await expect(loadServerConfig(answering(404, {}))).rejects.toThrow(
			`${CONFIG_PATH} answered 404`,
		);
		expect(useAppStore.getState().availableCameras).toEqual(["head"]);
	});
});
