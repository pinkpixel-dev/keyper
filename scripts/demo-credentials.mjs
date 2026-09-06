/**
 * Demo vault contents for marketing screenshots.
 *
 * Nothing here is real. The names are ordinary services so the dashboard looks
 * like a working vault without publishing anyone's actual stack, and the secret
 * values are obvious dummies so a reader who zooms in finds nothing.
 *
 * `type` must match a label in the Add Credential form's Type dropdown, and
 * `category` must match one of the default categories Keyper seeds on first
 * run. `document` is deliberately unused because that type needs a file upload.
 *
 * The order here is the order they are created, and the dashboard shows newest
 * first, so the last entries in this list appear top-left in the screenshot.
 */

export const DEMO_CREDENTIALS = [
  {
    title: 'Notion',
    type: 'Login',
    description: 'Team workspace',
    url: 'https://notion.so',
    category: 'Work',
    priority: 'Low',
    tags: ['docs', 'workspace'],
    secret: { username: 'demo@example.com', password: 'not-a-real-password' },
  },
  {
    title: 'Figma',
    type: 'Login',
    description: 'Design files',
    url: 'https://figma.com',
    category: 'Work',
    priority: 'Low',
    tags: ['design', 'team'],
    secret: { username: 'demo@example.com', password: 'not-a-real-password' },
  },
  {
    title: 'Docker Hub',
    type: 'Login',
    description: 'Image registry account',
    url: 'https://hub.docker.com',
    category: 'Development',
    priority: 'Medium',
    tags: ['registry', 'ci'],
    secret: { username: 'demo-user', password: 'not-a-real-password' },
  },
  {
    title: 'Linear',
    type: 'API Key',
    description: 'Issue tracker integration',
    url: 'https://linear.app',
    category: 'Work',
    priority: 'Medium',
    tags: ['api', 'issues'],
    secret: { apiKey: 'lin_api_EXAMPLE_NOT_A_REAL_KEY' },
  },
  {
    title: 'SendGrid',
    type: 'API Key',
    description: 'Transactional email',
    url: 'https://sendgrid.com',
    category: 'Development',
    priority: 'Medium',
    tags: ['email', 'api'],
    secret: { apiKey: 'SG.EXAMPLE_NOT_A_REAL_KEY' },
  },
  {
    title: 'Datadog',
    type: 'API Key',
    description: 'Metrics and log ingestion',
    url: 'https://datadoghq.com',
    category: 'Cloud Services',
    priority: 'Medium',
    tags: ['monitoring', 'api'],
    secret: { apiKey: 'dd_EXAMPLE_NOT_A_REAL_KEY' },
  },
  {
    title: 'Vercel',
    type: 'Token',
    description: 'Deploy hook token',
    url: 'https://vercel.com',
    category: 'Cloud Services',
    priority: 'Medium',
    tags: ['deploy', 'token'],
    secret: { token: 'vc_EXAMPLE_NOT_A_REAL_TOKEN' },
  },
  {
    title: 'npm Publish Token',
    type: 'Token',
    description: 'Automation token for releases',
    url: 'https://npmjs.com',
    category: 'Development',
    priority: 'High',
    tags: ['npm', 'release', 'ci'],
    secret: { token: 'npm_EXAMPLE_NOT_A_REAL_TOKEN' },
  },
  {
    title: 'GitHub',
    type: 'Token',
    description: 'Personal access token',
    url: 'https://github.com',
    category: 'Development',
    priority: 'High',
    tags: ['git', 'pat', 'ci'],
    secret: { token: 'ghp_EXAMPLE_NOT_A_REAL_TOKEN' },
  },
  {
    title: 'Cloudflare',
    type: 'API Key',
    description: 'DNS and Pages deploys',
    url: 'https://dash.cloudflare.com',
    category: 'Cloud Services',
    priority: 'High',
    tags: ['dns', 'pages', 'api'],
    secret: { apiKey: 'cf_EXAMPLE_NOT_A_REAL_KEY' },
  },
  {
    title: 'Stripe',
    type: 'API Key',
    description: 'Live payments key',
    url: 'https://dashboard.stripe.com',
    category: 'Finance',
    priority: 'Critical',
    tags: ['payments', 'api', 'live'],
    secret: { apiKey: 'sk_live_EXAMPLE_NOT_A_REAL_KEY' },
  },
  {
    title: 'Postgres Primary',
    type: 'Login',
    description: 'Production database role',
    url: 'https://console.neon.tech',
    category: 'Development',
    priority: 'Critical',
    tags: ['database', 'prod'],
    secret: { username: 'app_readwrite', password: 'not-a-real-password' },
  },
  {
    title: 'AWS Access Key',
    type: 'Secret',
    description: 'Deploy role credentials',
    url: 'https://console.aws.amazon.com',
    category: 'Cloud Services',
    priority: 'Critical',
    tags: ['aws', 'deploy', 'iam'],
    secret: { secret: 'AKIA_EXAMPLE_NOT_A_REAL_SECRET' },
  },
  {
    title: 'Backup Recovery Codes',
    type: 'Miscellaneous',
    description: 'Two-factor recovery codes',
    category: 'Security',
    priority: 'Critical',
    tags: ['2fa', 'recovery'],
    secret: {
      misc: [
        'EXAMPLE-CODE-0001',
        'EXAMPLE-CODE-0002',
        'EXAMPLE-CODE-0003',
        'EXAMPLE-CODE-0004',
      ].join('\n'),
    },
  },
  {
    title: 'TLS Certificate',
    type: 'Certificate',
    description: 'Wildcard cert for the staging domain',
    category: 'Security',
    priority: 'High',
    tags: ['tls', 'staging'],
    secret: {
      certificate: [
        '-----BEGIN CERTIFICATE-----',
        'EXAMPLE0NOT0A0REAL0CERTIFICATE0THIS0IS0PLACEHOLDER0CONTENT0FOR0',
        'SCREENSHOTS0ONLY0AND0CARRIES0NO0KEY0MATERIAL0WHATSOEVER000000',
        '-----END CERTIFICATE-----',
      ].join('\n'),
    },
  },
];

/**
 * Which form field holds the secret for each credential type. The Add
 * Credential form swaps this field when the type changes, so the script has to
 * know which label to look for. Keys are the dropdown labels; values map a key
 * in a credential's `secret` object to the field's visible label.
 */
export const SECRET_FIELDS = {
  'API Key': { apiKey: 'API Key' },
  Login: { username: 'Username', password: 'Password' },
  Secret: { secret: 'Secret Value' },
  Token: { token: 'Token' },
  Certificate: { certificate: 'Certificate Data' },
  Miscellaneous: { misc: 'Sensitive Value' },
};
