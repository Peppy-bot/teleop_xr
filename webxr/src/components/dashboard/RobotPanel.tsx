"use client";

import { useCallback, useEffect, useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	chooseRobot,
	fetchRobotChoice,
	followRobotChoice,
	offerLabel,
	type RobotChoice,
} from "@/lib/robot_choice";

/**
 * The robot the headset drives, chosen among the ones the server offers, each
 * with who holds it. The card follows the server's event stream, so each
 * change shows as it happens.
 */
export function RobotPanel() {
	// undefined until the server answered; null when it offers no choice.
	const [choice, setChoice] = useState<RobotChoice | null | undefined>(
		undefined,
	);
	// The server's refusal of the last choice, or why the offer is unreadable.
	const [note, setNote] = useState<string | null>(null);
	// True while a choice is posted and the offer re-read.
	const [busy, setBusy] = useState(false);

	const refresh = useCallback(async () => {
		try {
			const served = await fetchRobotChoice();
			setChoice(served);
			return served;
		} catch (error) {
			setNote(error instanceof Error ? error.message : String(error));
			return undefined;
		}
	}, []);

	useEffect(() => {
		let stop: (() => void) | undefined;
		let unmounted = false;
		void refresh().then((served) => {
			// A server that offers no choice has no stream to follow.
			if (served && !unmounted) {
				stop = followRobotChoice(setChoice, setNote);
			}
		});
		return () => {
			unmounted = true;
			stop?.();
		};
	}, [refresh]);

	const choose = async (name: string) => {
		setBusy(true);
		try {
			setNote(await chooseRobot(name));
		} catch (error) {
			setNote(error instanceof Error ? error.message : String(error));
		}
		await refresh();
		setBusy(false);
	};

	if (choice === null || (choice === undefined && note === null)) {
		return null;
	}
	return (
		<Card className="w-full">
			<CardHeader>
				<CardTitle>Robot</CardTitle>
				<CardDescription>Robot to drive</CardDescription>
			</CardHeader>
			<CardContent className="space-y-2">
				{choice && choice.robots.length === 0 && (
					<div className="text-sm text-muted-foreground">{choice.empty}</div>
				)}
				{choice && choice.robots.length > 0 && (
					<select
						aria-label="Robot to drive"
						className="w-full rounded-md border bg-background px-3 py-2 text-sm"
						value={choice.chosen ?? ""}
						disabled={busy}
						onChange={(event) => void choose(event.target.value)}
					>
						{choice.chosen === null && <option value="">Choose a robot</option>}
						{choice.robots.map((robot) => (
							<option key={robot.name} value={robot.name}>
								{offerLabel(robot)}
							</option>
						))}
					</select>
				)}
				{note && <div className="text-sm text-destructive">{note}</div>}
			</CardContent>
		</Card>
	);
}
