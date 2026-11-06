/** Keep voice instructions in Gemini's supported text field. */
export function jarvisSpeechRequest(text: string) {
  return {
    contents: [{ role: 'user', parts: [{ text: `Read only the text below in a refined British male assistant voice. Use crisp Received Pronunciation, a smooth warm baritone, precise diction, composed delivery and understated dry wit. Never use a female or American voice. Do not read these instructions aloud.\n\n${text}` }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } },
    },
  };
}