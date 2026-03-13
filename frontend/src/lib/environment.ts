export interface EnvironmentInfo {
  isInGameBrowser: boolean;
  viewportWidth: number;
  viewportHeight: number;
}

export function detectEnvironment(): EnvironmentInfo {
  const params = new URLSearchParams(window.location.search);
  const isInGameByParam = params.get('mode') === 'ingame';
  const isInGameByViewport =
    window.innerWidth === 787 && window.innerHeight === 1198;

  return {
    isInGameBrowser: isInGameByParam || isInGameByViewport,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
}
