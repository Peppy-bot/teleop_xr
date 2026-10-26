/**
 * The routes behind the Robot card. GET lists the robots on offer, each with
 * its state; POST, with the form field `robot`, chooses one, answering 400
 * with the reason when it refuses. The event stream sends the offer again
 * whenever a robot, its state or the choice changes. A server that offers no
 * choice has no such routes, and the card stays hidden.
 */
export const ROBOT_PATH = "/robot";
export const ROBOT_EVENTS_PATH = "/robot/events";
export const ROBOT_FIELD = "robot";

export type RobotOffer = {
	/** The robot's name. */
	name: string;
	/** Who holds the robot, in the server's words; empty when it says none. */
	state: string;
};

export type RobotChoice = {
	/** The robots on offer. */
	robots: RobotOffer[];
	/** The one driven; null while none is. */
	chosen: string | null;
	/** What the card says while no robot is on offer. */
	empty: string;
};

function isOffer(robot: unknown): robot is RobotOffer {
	const record = robot as Partial<Record<keyof RobotOffer, unknown>> | null;
	return typeof record?.name === "string" && typeof record?.state === "string";
}

/**
 * `body`, the server's answer at `path`, as a choice; throws on any other
 * shape.
 */
export function parseRobotChoice(
	body: unknown,
	path: string = ROBOT_PATH,
): RobotChoice {
	const record = body as Partial<Record<keyof RobotChoice, unknown>> | null;
	const robots = record?.robots;
	const chosen = record?.chosen;
	const empty = record?.empty;
	if (
		!Array.isArray(robots) ||
		!robots.every(isOffer) ||
		(chosen !== null && typeof chosen !== "string") ||
		typeof empty !== "string"
	) {
		throw new Error(`${path} answered with a malformed body`);
	}
	return {
		robots: robots.map(({ name, state }) => ({ name, state })),
		chosen,
		empty,
	};
}

/** How the card names a robot: with its state when the server gives one. */
export function offerLabel(robot: RobotOffer): string {
	return robot.state ? `${robot.name}: ${robot.state}` : robot.name;
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

/** The part of an EventSource the card uses. */
export type EventStream = {
	onmessage: ((event: MessageEvent<string>) => void) | null;
	close(): void;
};

/**
 * Follow the offer on the server's event stream: `onChoice` gets each offer,
 * `onError` the reason of each one that cannot be read. Returns the stop.
 */
export function followRobotChoice(
	onChoice: (choice: RobotChoice) => void,
	onError: (reason: string) => void,
	open: (path: string) => EventStream = (path) => new EventSource(path),
): () => void {
	const stream = open(ROBOT_EVENTS_PATH);
	stream.onmessage = (event) => {
		try {
			onChoice(parseRobotChoice(JSON.parse(event.data), ROBOT_EVENTS_PATH));
		} catch (error) {
			onError(error instanceof Error ? error.message : String(error));
		}
	};
	return () => stream.close();
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
