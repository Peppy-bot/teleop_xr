import { describe, expect, it } from "vitest";

import {
	chooseRobot,
	type EventStream,
	fetchRobotChoice,
	followRobotChoice,
	offerLabel,
	parseRobotChoice,
	ROBOT_EVENTS_PATH,
	ROBOT_FIELD,
	ROBOT_PATH,
	type RobotChoice,
} from "../lib/robot_choice";

const answer = (status: number, body: unknown) =>
	({
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
		text: async () => String(body),
	}) as Response;

const OFFER: RobotChoice = {
	robots: [
		{ name: "alpha", state: "driven from this headset" },
		{ name: "bravo", state: "leased by director_inst (tidy the table)" },
	],
	chosen: "alpha",
	empty: "none",
};

describe("parseRobotChoice", () => {
	it("reads the robots on offer with their states, the chosen one and the empty text", () => {
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
		{ ...OFFER, robots: ["alpha"] },
		{ ...OFFER, robots: [{ name: "alpha" }] },
		{ ...OFFER, robots: [{ name: "alpha", state: 3 }] },
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

describe("offerLabel", () => {
	it("names a robot with its state, and alone when the state is empty", () => {
		expect(offerLabel({ name: "alpha", state: "free" })).toBe("alpha: free");
		expect(offerLabel({ name: "alpha", state: "" })).toBe("alpha");
	});
});

describe("followRobotChoice", () => {
	class FakeStream implements EventStream {
		onmessage: ((event: MessageEvent<string>) => void) | null = null;
		closed = false;

		send(data: string) {
			this.onmessage?.({ data } as MessageEvent<string>);
		}

		close() {
			this.closed = true;
		}
	}

	it("hands on each offer of the stream, and the reason of a malformed one", () => {
		const opened: string[] = [];
		const stream = new FakeStream();
		const choices: RobotChoice[] = [];
		const errors: string[] = [];
		const stop = followRobotChoice(
			(choice) => choices.push(choice),
			(reason) => errors.push(reason),
			(path) => {
				opened.push(path);
				return stream;
			},
		);

		expect(opened).toEqual([ROBOT_EVENTS_PATH]);
		stream.send(JSON.stringify(OFFER));
		stream.send(JSON.stringify({ robots: ["alpha"] }));
		expect(choices).toEqual([OFFER]);
		expect(errors).toEqual([
			`${ROBOT_EVENTS_PATH} answered with a malformed body`,
		]);
		stop();
		expect(stream.closed).toBe(true);
	});
});
