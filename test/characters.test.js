'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const characters = require('../server/characters');

test('all playable characters have unique IDs, names, and existing image files', () => {
  assert.equal(characters.length, 39);
  assert.equal(new Set(characters.map(c => c.id)).size, 39);
  assert.equal(new Set(characters.map(c => c.name)).size, 39);
  for (const character of characters) {
    assert.ok(character.image.startsWith('/pictures/'));
    assert.ok(/\.(png|svg)$/.test(character.image));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', character.image.slice(1))), `${character.name}: missing ${character.image}`);
  }
});

test('the two explicitly removed characters are absent', () => {
  assert.ok(!characters.some(c => c.ability === 'suppression' || c.ability === 'jump'));
});
