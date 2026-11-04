const mongoose = require('mongoose');
const Question = require('../models/Question');

const base = {
  text: 'Sample question?',
  subject: 'Math',
  topic: 'Algebra',
  difficulty: 'easy',
  createdBy: new mongoose.Types.ObjectId(),
};

// Returns the validation error message, or undefined if the question is valid.
const check = async (overrides) => {
  try {
    await new Question({ ...base, ...overrides }).validate();
    return undefined;
  } catch (err) {
    return err.message;
  }
};

describe('CSQP-F-021 question types', () => {
  test('valid MCQ passes', async () => {
    expect(await check({ type: 'MCQ', options: ['1', '2', '3'], answer: '2' })).toBeUndefined();
  });
  test('MCQ with one option fails', async () => {
    expect(await check({ type: 'MCQ', options: ['1'], answer: '1' })).toMatch(/between 2 and 6/);
  });
  test('MCQ with duplicate options fails', async () => {
    expect(await check({ type: 'MCQ', options: ['1', '1'], answer: '1' })).toMatch(/unique/);
  });
  test('MCQ answer not in options fails', async () => {
    expect(await check({ type: 'MCQ', options: ['1', '2'], answer: '9' })).toMatch(/match one of the options/);
  });
  test('valid True/False passes', async () => {
    expect(await check({ type: 'TRUE_FALSE', answer: 'True' })).toBeUndefined();
  });
  test('True/False with other answer fails', async () => {
    expect(await check({ type: 'TRUE_FALSE', answer: 'banana' })).toMatch(/True\/False/);
  });
  test('valid short answer passes', async () => {
    expect(await check({ type: 'SUBJECTIVE', answer: 'Photosynthesis' })).toBeUndefined();
  });
  test('short answer without answer fails', async () => {
    expect(await check({ type: 'SUBJECTIVE', answer: '' })).toBeDefined();
  });
});
