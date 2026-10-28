export const sampleOriginal = JSON.stringify({
  name: 'orbit-api',
  version: '1.2.0',
  environment: 'production',
  server: { host: 'api.orbit.dev', port: 8080, ssl: false },
  features: { darkMode: true, analytics: true },
  regions: ['us-east-1', 'eu-west-1'],
  deprecated: true,
}, null, 2)

export const sampleModified = JSON.stringify({
  name: 'orbit-api',
  version: '2.0.0',
  environment: 'production',
  server: { host: 'api.orbit.dev', port: 443, ssl: true },
  features: { darkMode: true, analytics: false, liveSync: true },
  regions: ['us-east-1', 'ap-south-1', 'eu-west-1'],
  timeout: 5000,
}, null, 2)
