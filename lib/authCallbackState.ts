let isHandlingAuthCallback = false;
let bootHoldUntil = 0;

export const setHandlingAuthCallback = (value: boolean) => {
  isHandlingAuthCallback = value;
};

export const getHandlingAuthCallback = () => isHandlingAuthCallback;

export const startBootHold = (ms: number) => {
  bootHoldUntil = Date.now() + ms;
};

export const isBootHold = () => Date.now() < bootHoldUntil;
