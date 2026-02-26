export interface AzureConfig {
  endpoint?: string;
  apiKey?: string;
  apiVersion?: string;
}

export function loadAzureConfigFromEnv(): AzureConfig | null {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;

  if (!endpoint && !apiKey) return null;
  return { endpoint, apiVersion, apiKey };
}

export function hasAzureConfigInEnv(): boolean {
  return !!(process.env.AZURE_OPENAI_ENDPOINT || process.env.AZURE_OPENAI_API_KEY);
}
