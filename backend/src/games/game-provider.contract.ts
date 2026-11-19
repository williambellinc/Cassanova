export interface GameLaunchRequest {
  playerReference: string;
  gameCode: string;
  currency: string;
  mode: 'demo' | 'real';
  jurisdiction: string;
  returnUrl: string;
  sessionReference: string;
}

export interface GameLaunchResponse {
  launchUrl: string;
  providerSessionReference: string;
  expiresAt: Date;
}

export interface GameProviderAdapter {
  readonly providerId: string;
  launch(request: GameLaunchRequest): Promise<GameLaunchResponse>;
  verifyCallback(rawBody: Buffer, signature: string): Promise<boolean>;
}

/** No third-party game supplier is enabled until a signed agreement and technical certification exist. */
export const gameProviders: ReadonlyMap<string, GameProviderAdapter> = new Map();
