import { test } from 'node:test';
import assert from 'node:assert/strict';
import { instructions, formatInstruction, parseTour, exampleTour } from './tools/tours/lexicon.js';

test('every lexicon entry round-trips through the text format', () => {
  for (const definition of instructions) {
    const value = definition.parameter === 'seconds' ? '1.25' : 'A "quoted" name \\ path';
    const text = formatInstruction(definition.id, value);
    const [step] = parseTour(text);
    assert.equal(step.id, definition.id);
    assert.equal(step.text, text);
    if (definition.parameter && definition.parameter !== 'seconds') assert.equal(step.value, value);
    for (const alias of definition.aliases || []) assert.equal(parseTour(alias)[0].id, definition.id);
  }
});
test('parser handles casing, CRLF, blanks, decimals, and source line numbers', () => {
  const steps = parseTour('\r\n open APP \r\n\r\nwait .5 seconds\r\n');
  assert.deepEqual(steps.map(step => [step.id, step.line]), [['open', 2], ['wait', 4]]);
  assert.equal(steps[1].text, 'Wait 0.5 seconds');
  assert.equal(parseTour(exampleTour).length, 8);
});
test('malformed and incomplete instructions fail with their line number', () => {
  for (const line of ['Fly away', 'Wait 0 seconds', 'Wait 61 seconds', 'Wait Infinity seconds', 'Wait 1e1 seconds', 'Open project nope', 'Open project ""', 'Open project "a" extra', 'Click contact 123']) {
    assert.throws(() => parseTour(`Open app\n\n${line}`), /Line 3:/, line);
  }
  assert.throws(() => parseTour('  \n'), /empty/);
  assert.throws(() => formatInstruction('bad'), /Unknown/);
  assert.throws(() => formatInstruction('project', 'two\nlines'), /single-line/);
});
