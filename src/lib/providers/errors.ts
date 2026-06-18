export class AIClientError extends Error {
  constructor(
    message: string,
    public readonly code: 'MISSING_KEY' | 'API_ERROR' | 'TIMEOUT' | 'NETWORK_ERROR' = 'API_ERROR',
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'AIClientError';
  }
}
