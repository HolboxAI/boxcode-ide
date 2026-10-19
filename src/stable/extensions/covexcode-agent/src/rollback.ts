/*---------------------------------------------------------------------------------------------
 *  Copyright (c) HolboxAI. Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import type { ChangeEntry } from './acpClient';

/**
 * The highest 1-based turn number present in the rollback journal -- the turn
 * that corresponds to the most recent user query. `undefined` when the journal
 * has no entries (nothing to undo).
 *
 * The "undo last query" action restores every file touched at this turn or
 * later back to its state just before this turn began (`restoreBeforeTurn`),
 * which is exactly "undo the last query" -- earlier turns' edits survive.
 * Extracted from `extension.ts` so the turn selection is unit-testable
 * without a live ACP session.
 */
export function latestTurn(changes: ChangeEntry[]): number | undefined {
	let latest: number | undefined;
	for (const change of changes) {
		if (typeof change.turn !== 'number' || !Number.isFinite(change.turn)) {
			continue;
		}
		if (latest === undefined || change.turn > latest) {
			latest = change.turn;
		}
	}
	return latest;
}
