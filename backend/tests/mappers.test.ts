import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapNumberToPriority, mapPriorityToNumber } from '../src/utils/mappers';

test('priority → number', () => {
  assert.equal(mapPriorityToNumber('low'), 1);
  assert.equal(mapPriorityToNumber('MEDIUM'), 3);
  assert.equal(mapPriorityToNumber('high'), 5);
  assert.equal(mapPriorityToNumber('невідомо'), 3);
});

test('number → priority', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(mapNumberToPriority), ['low', 'low', 'medium', 'high', 'high']);
});

test('перетворення втратне для 2 і 4 (задокументована поведінка)', () => {
  assert.equal(mapPriorityToNumber(mapNumberToPriority(2)), 1);
  assert.equal(mapPriorityToNumber(mapNumberToPriority(4)), 5);
});
