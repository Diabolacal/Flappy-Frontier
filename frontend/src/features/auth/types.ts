export interface PlayerIdentity {
  address: string | null;
  displayName: string;
  isInGameBrowser: boolean;
}

export const ANONYMOUS_PLAYER: PlayerIdentity = {
  address: null,
  displayName: 'Pilot',
  isInGameBrowser: false,
};
