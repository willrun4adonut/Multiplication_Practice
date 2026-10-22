export const usePlaygroundState = (initialState: any) => {
  return [initialState, () => {}];
};

export const playground = {
  ready: () => Promise.resolve(),
  getState: () => ({}),
  setState: () => {},
};
