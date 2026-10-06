/*---------------------------------------------------------------------------------------------
 *  Copyright (c) HolboxAI. Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/**
 * The key-press half of `interact_in_browser`: maps a small, explicit
 * allow-list of named keys to the two CDP `Input.dispatchKeyEvent` messages
 * (keyDown then keyUp) that press them. Pure and host-independent so it
 * unit-tests in plain Node, the same pattern as `axTree.ts` (see
 * `browserKeys.test.ts`).
 *
 * Deliberately a curated map, not a general key-name resolver: every entry's
 * `windowsVirtualKeyCode` is written out explicitly rather than derived, so
 * there is nothing to guess about. A key outside the list yields `undefined`,
 * and the caller rejects the interaction with an honest message instead of
 * synthesizing a bogus keyCode. `nativeVirtualKeyCode` is deliberately left
 * unset -- it is platform-specific (a Mac scancode on macOS), and omitting it
 * lets Chromium fall back to `windowsVirtualKeyCode`, which is what the DOM
 * `keyCode` is actually computed from. Modifier chords (Ctrl/Cmd/Shift/Alt)
 * and printable characters are out of scope: printable text is `type`'s job,
 * and chords are a follow-up.
 */

/** One CDP `Input.dispatchKeyEvent` params object (`type` filled per message). */
export interface CdpInputEvent {
	type: 'keyDown' | 'keyUp';
	key: string;
	code: string;
	text?: string;
	windowsVirtualKeyCode: number;
}

/** The two events that together make one key press. */
export interface KeyPressEvents {
	keyDown: CdpInputEvent;
	keyUp: CdpInputEvent;
}

/** `key` (the DOM KeyboardEvent.key value) -> the press's invariant half. */
type KeyBase = Omit<CdpInputEvent, 'type'>;

const KEYS: Record<string, KeyBase> = {
	Enter: { key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13 },
	Tab: { key: 'Tab', code: 'Tab', text: '\t', windowsVirtualKeyCode: 9 },
	Escape: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
	Backspace: { key: 'Backspace', code: 'Backspace', text: '\b', windowsVirtualKeyCode: 8 },
	Delete: { key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 },
	ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38 },
	ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 },
	ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 },
	ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 },
	Home: { key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 },
	End: { key: 'End', code: 'End', windowsVirtualKeyCode: 35 },
	PageUp: { key: 'PageUp', code: 'PageUp', windowsVirtualKeyCode: 33 },
	PageDown: { key: 'PageDown', code: 'PageDown', windowsVirtualKeyCode: 34 },
	F5: { key: 'F5', code: 'F5', windowsVirtualKeyCode: 116 },
};

/** The allow-list as a human-readable string, for the `failed` reason. */
export const SUPPORTED_KEYS = Object.keys(KEYS).join(', ');

/**
 * The keyDown/keyUp pair that presses `key`, or `undefined` when `key` is not
 * in the allow-list -- the caller turns that into an honest failure rather
 * than guessing a keyCode for a key it does not understand.
 */
export function keyPressEvents(key: string): KeyPressEvents | undefined {
	const base = KEYS[key];
	if (!base) {
		return undefined;
	}
	return {
		keyDown: { type: 'keyDown', ...base },
		keyUp: { type: 'keyUp', ...base },
	};
}
