export interface EnvironmentInfo {
  isInGameBrowser: boolean;
  viewportWidth: number;
  viewportHeight: number;
}

export function detectEnvironment(): EnvironmentInfo {
  const params = new URLSearchParams(window.location.search);
  const isInGameByParam = params.get('mode') === 'ingame';
  const isInGameByViewport =
    Math.abs(window.innerWidth - 787) <= 5 &&
    Math.abs(window.innerHeight - 1198) <= 5;

  return {
    isInGameBrowser: isInGameByParam || isInGameByViewport,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
}
