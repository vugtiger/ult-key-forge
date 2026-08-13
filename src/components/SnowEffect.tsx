// Background music has been removed from the app.
// This module is kept as a no-op shim so existing imports keep working.

export const toggleSnowSound = (): boolean => false;
export const isSnowSoundOn = (): boolean => false;
export const playButtonClickSound = () => {};
export const createSnowBurst = (_x: number, _y: number) => {};

const SnowEffect = () => null;

export default SnowEffect;
