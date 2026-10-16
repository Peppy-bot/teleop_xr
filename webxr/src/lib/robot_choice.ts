/**
 * The route behind the Robot card. GET lists the robots on offer; POST, with
 * the form field `robot`, chooses one, answering 400 with the reason when it
 * refuses. A server that offers no choice has no such route, and the card
 * stays hidden.
 */
export const ROBOT_PATH = "/robot";
export const ROBOT_FIELD = "robot";

export type RobotChoice = {
	/** The robots on offer. */
	robots: string[];
	/** The one driven; null while none is. */
	chosen: string | null;
	/** What the card says while no robot is on offer. */
	empty: string;
};

/** `body`, the answer to GET, as a choice; throws on any other shape. */
export function parseRobotChoice(body: unknown): RobotChoice {
	const record = body as Partial<Record<keyof RobotChoice, unknown>> | null;
	const robots = record?.robots;
	const chosen = record?.chosen;
	const empty = record?.empty;
	if (
		!Array.isArray(robots) ||
		!robots.every((name) => typeof name === "string") ||
		(chosen !== null && typeof chosen !== "string") ||
		typeof empty !== "string"
	) {
		throw new Error(`${ROBOT_PATH} answered with a malformed body`);
	}
	return { robots, chosen, empty };
}

/** The robots on offer, or null when the server offers no choice. */
export async function fetchRobotChoice(
	fetchFn: typeof fetch = fetch,
): Promise<RobotChoice | null> {
	const response = await fetchFn(ROBOT_PATH);
	if (response.status === 404) {
		return null;
	}
	if (!response.ok) {
		throw new Error(`${ROBOT_PATH} answered ${response.status}`);
	}
	return parseRobotChoice(await response.json());
}

/** Drive `name`: null once the server took it, else its refusal text. */
export async function chooseRobot(
	name: string,
	fetchFn: typeof fetch = fetch,
): Promise<string | null> {
	const response = await fetchFn(ROBOT_PATH, {
		method: "POST",
		body: new URLSearchParams({ [ROBOT_FIELD]: name }),
	});
	return response.ok ? null : await response.text();
}
