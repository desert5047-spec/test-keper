let isHandlingAuthCallback = false;

export const setHandlingAuthCallback = (value: boolean) => {
  isHandlingAuthCallback = value;
};

export const getHandlingAuthCallback = () => isHandlingAuthCallback;
