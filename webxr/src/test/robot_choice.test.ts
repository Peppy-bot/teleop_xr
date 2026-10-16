import { describe, expect, it } from "vitest";

import {
	chooseRobot,
	fetchRobotChoice,
	parseRobotChoice,
	ROBOT_FIELD,
	ROBOT_PATH,
} from "../lib/robot_choice";

const answer = (status: number, body: unknown) =>
	({
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
		text: async () => String(body),
	}) as Response;

const OFFER = { robots: ["alpha", "bravo"], chosen: "alpha", empty: "none" };

describe("parseRobotChoice", () => {
	it("reads the robots on offer, the chosen one and the empty text", () => {
		expect(parseRobotChoice(OFFER)).toEqual(OFFER);
		expect(parseRobotChoice({ ...OFFER, chosen: null })).toEqual({
			...OFFER,
			chosen: null,
		});
	});

	it.each([
		null,
		{},
		{ ...OFFER, robots: "alpha" },
		{ ...OFFER, robots: [1] },
		{ ...OFFER, chosen: 2 },
		{ ...OFFER, empty: undefined },
	])("refuses the malformed body %j", (body) => {
		expect(() => parseRobotChoice(body)).toThrow("malformed body");
	});
});

describe("fetchRobotChoice", () => {
	it("returns the offer the route lists", async () => {
		const asked: string[] = [];
		const fetchFn = (async (path: string) => {
			asked.push(path);
			return answer(200, OFFER);
		}) as unknown as typeof fetch;

		expect(await fetchRobotChoice(fetchFn)).toEqual(OFFER);
		expect(asked).toEqual([ROBOT_PATH]);
	});

	it("returns null where the server offers no choice", async () => {
		const fetchFn = (async () => answer(404, "")) as unknown as typeof fetch;

		expect(await fetchRobotChoice(fetchFn)).toBeNull();
	});

	it("throws on any other failure", async () => {
		const fetchFn = (async () => answer(500, "")) as unknown as typeof fetch;

		await expect(fetchRobotChoice(fetchFn)).rejects.toThrow(
			`${ROBOT_PATH} answered 500`,
		);
	});
});

describe("chooseRobot", () => {
	it("posts the robot as the form field and returns null once taken", async () => {
		const posted: { path: string; init: RequestInit | undefined }[] = [];
		const fetchFn = (async (path: string, init?: RequestInit) => {
			posted.push({ path, init });
			return answer(204, "");
		}) as unknown as typeof fetch;

		expect(await chooseRobot("bravo", fetchFn)).toBeNull();
		expect(posted).toHaveLength(1);
		expect(posted[0].path).toBe(ROBOT_PATH);
		expect(posted[0].init?.method).toBe("POST");
		expect(String(posted[0].init?.body)).toBe(`${ROBOT_FIELD}=bravo`);
	});

	it("returns the refusal text when the server refuses", async () => {
		const fetchFn = (async () =>
			answer(400, "robot 'x' is not on offer")) as unknown as typeof fetch;

		expect(await chooseRobot("x", fetchFn)).toBe("robot 'x' is not on offer");
	});
});
