import { test, expect } from 'bun:test';
import { jarvisSpeechRequest } from './voice-request';

test('conversational Jarvis explicitly selects his male voice using Gemini’s native contract', () => {
  const request = jarvisSpeechRequest('At your service, sir.');
  expect(request.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Charon');
  expect(request.generationConfig.responseModalities).toEqual(['AUDIO']);
  expect(request.contents[0].parts[0].text).toContain('British male');
  expect(request.contents[0].parts[0].text.endsWith('At your service, sir.')).toBe(true);
});