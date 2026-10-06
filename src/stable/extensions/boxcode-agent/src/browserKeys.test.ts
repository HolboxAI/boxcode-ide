/*---------------------------------------------------------------------------------------------
 *  Copyright (c) HolboxAI. Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { keyPressEvents, SUPPORTED_KEYS } from './browserKeys';

test('keyPressEvents returns a keyDown/keyUp pair for a supported key', () => {
	const events = keyPressEvents('Enter');
	assert.ok(events);
	assert.deepEqual(events.keyDown, {
		type: 'keyDown',
		key: 'Enter',
		code: 'Enter',
		text: '\r',
		windowsVirtualKeyCode: 13,
	});
	assert.deepEqual(events.keyUp, {
		type: 'keyUp',
		key: 'Enter',
		code: 'Enter',
		text: '\r',
		windowsVirtualKeyCode: 13,
	});
});

test('non-text keys omit the text field rather than sending an empty one', () => {
	const events = keyPressEvents('Escape');
	assert.ok(events);
	assert.equal('text' in events.keyDown, false);
	assert.equal(events.keyDown.windowsVirtualKeyCode, 27);
});

test('keyPressEvents returns undefined for a key outside the allow-list', () => {
	assert.equal(keyPressEvents('EnterX'), undefined);
	assert.equal(keyPressEvents('a'), undefined);
	assert.equal(keyPressEvents(''), undefined);
});

test('SUPPORTED_KEYS names the whole allow-list', () => {
	for (const key of ['Enter', 'Tab', 'Escape', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'F5']) {
		assert.ok(SUPPORTED_KEYS.includes(key), key);
	}
});
