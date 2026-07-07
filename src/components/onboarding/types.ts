export interface TabInfo {
  title: string;
  url: string;
  domain: string;
}

export interface OnboardingConfig {
  provider: { id: string; label: string; keyUrl: string; keyHint: string } | null;
  apiKey: string;
  chatModel: string;
  theme: 'dark' | 'light' | 'system';
  accentColor: string;
  fontFamily: 'sans' | 'serif' | 'mono';
  fontSize: 'sm' | 'md' | 'lg';
}
