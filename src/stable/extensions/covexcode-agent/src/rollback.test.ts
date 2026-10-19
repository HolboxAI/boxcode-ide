/*---------------------------------------------------------------------------------------------
 *  Copyright (c) HolboxAI. Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChangeEntry } from './acpClient';
import { latestTurn } from './rollback';

function entry(turn: number, action: ChangeEntry['action'] = 'restore'): ChangeEntry {
	return { path: `/tmp/f${turn}.txt`, turn, touches: 1, action };
}

test('latestTurn is undefined for an empty journal', () => {
	assert.equal(latestTurn([]), undefined);
});

test('latestTurn is the single turn in a one-entry journal', () => {
	assert.equal(latestTurn([entry(3)]), 3);
});

test('latestTurn picks the highest turn across entries, not insertion order', () => {
	assert.equal(latestTurn([entry(5), entry(2), entry(7), entry(1)]), 7);
});

test('latestTurn ignores non-finite and missing turn numbers', () => {
	const malformed = [
		{ path: '/a', turn: Number.NaN, touches: 1, action: 'restore' } as ChangeEntry,
		{ path: '/b', turn: undefined as unknown as number, touches: 1, action: 'restore' } as ChangeEntry,
		entry(4),
	];
	assert.equal(latestTurn(malformed), 4);
});

test('latestTurn still counts a turn whose only entry is shell-blocked (last query may have made no file edit)', () => {
	// The last query may have only run a shell command (blocked, no before-state).
	// It is still the "last query" and should be the undo target even though
	// rolling back to it restores nothing.
	assert.equal(latestTurn([entry(2), entry(4, 'blocked')]), 4);
});
