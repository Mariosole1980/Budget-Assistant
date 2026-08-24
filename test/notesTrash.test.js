'use strict';

// ===========================================================================
// Notes-trash regression guards: a note soft-deleted into the notes trash bin
// must NEVER come back into the active Notes list on the next sync.
//
// Reported bug: "ο κάδος ανακύκλωσης των σημειώσεων επιστρέφει σημειώσεις
// πίσω μέσα στις σημειώσεις" — deleting a note (offline/guest) moved it to
// the trash, but the next cloud sync re-added it to the Notes tab because
// syncNotes()/mergeNotes() never consulted the LOCAL trash bin.
//
// app.js is a browser SPA and cannot be require()'d from Node, so these tests
// are SOURCE-LEVEL regression guards (same approach as bug04CloudPersistence).
// ===========================================================================

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const APP_JS = path.join(__dirname, '..', 'app.js');
const appSrc = fs.readFileSync(APP_JS, 'utf8');

// ---------------------------------------------------------------------------
// deleteNote: the local tombstone must carry updated_at === deleted_at so a
// later LWW merge cannot read a stale updated_at as "edited after deletion"
// and resurrect the note from the cloud.
// ---------------------------------------------------------------------------
test('deleteNote writes a consistent tombstone (updated_at mirrors deleted_at)', () => {
    const fn = appSrc.match(/async function deleteNote\(noteId\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(fn, 'deleteNote body not found');
    const body = fn[1];
    assert.match(body, /const deletedAt = new Date\(\)\.toISOString\(\);/);
    assert.match(body, /updated_at: deletedAt,/);
    assert.match(body, /deleted_at: deletedAt,/);
    // The cloud soft-delete uses the SAME tombstone timestamp (no drift).
    assert.match(body, /updated_at: deletedNote\.deleted_at/);
});

// ---------------------------------------------------------------------------
// syncNotes: the local trash bin is authoritative. A note present in the local
// trash must be EXCLUDED from the active list even when the remote copy is
// still status='active' (offline / guest-mode delete that never reached cloud).
// ---------------------------------------------------------------------------
test('syncNotes excludes notes still present in the local trash from the active list', () => {
    const fn = appSrc.match(/async function syncNotes\(\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(fn, 'syncNotes body not found');
    const body = fn[1];
    // Builds an id -> tombstone map from the local trash.
    assert.match(body, /const trashById = new Map\(trash\.map\(t => \[String\(t\.id\), t\]\)\);/);
    // Splits the merged result: trashed ids -> resurrected, everything else -> active.
    assert.match(body, /const resurrected = \[\];/);
    assert.match(body, /const activeNotes = \[\];/);
    assert.match(body, /const localTomb = trashById\.get\(String\(n\.id\)\);/);
    assert.match(body, /resurrected\.push\(\{ tomb: localTomb, remoteUpdatedAt: n\.updated_at \|\| n\.created_at \}\);/);
    assert.match(body, /state\.notes = activeNotes;/);
});

// ---------------------------------------------------------------------------
// syncNotes: offline deletes are re-asserted on the cloud (tombstone upsert)
// ONLY when this device's delete is newer than the remote note's last update.
// A newer remote edit/restore must not be clobbered.
// ---------------------------------------------------------------------------
test('syncNotes re-asserts newer offline deletes to the cloud but respects newer remote changes', () => {
    const fn = appSrc.match(/async function syncNotes\(\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(fn, 'syncNotes body not found');
    const body = fn[1];
    // Conflict-aware tombstone re-assertion.
    assert.match(body, /const tombTime = new Date\(tomb\.deleted_at \|\| tomb\.updated_at \|\| 0\)\.getTime\(\);/);
    assert.match(body, /const remoteTime = new Date\(remoteUpdatedAt \|\| 0\)\.getTime\(\);/);
    assert.match(body, /if \(tombTime < remoteTime\) return;/);
    // The re-asserted record is upserted with status 'deleted' + fresh timestamps.
    assert.match(body, /status: 'deleted',/);
    assert.match(body, /updated_at: now,/);
    assert.match(body, /deleted_at: tomb\.deleted_at \|\| now,/);
    assert.match(body, /records\.push\(mapNoteToDb\(\{/);
    // Dirty active notes are still pushed alongside the tombstones.
    assert.match(body, /const records = notesToUpsert\.map\(n => mapNoteToDb\(n, userId, familyId\)\);/);
});

// ---------------------------------------------------------------------------
// restoreNote: defensive dedupe — the restored note must not create a duplicate
// entry if it somehow already exists in the active list (e.g. restored on
// another device while still sitting in this device's trash).
// ---------------------------------------------------------------------------
test('restoreNote dedupes the active list before re-adding the restored note', () => {
    const fn = appSrc.match(/async function restoreNote\(noteId\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(fn, 'restoreNote body not found');
    const body = fn[1];
    const dedupeSeg = body.match(/\/\/ Defensive dedupe:[\s\S]*?state\.notes\.push\(restored\);/);
    assert.ok(dedupeSeg, 'restoreNote dedupe+push block not found');
    assert.match(dedupeSeg[0], /state\.notes = state\.notes\.filter\(n => String\(n\.id\) !== String\(noteId\)\);/);
    assert.match(dedupeSeg[0], /state\.notes\.push\(restored\);/);
});
