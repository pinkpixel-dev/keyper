// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://keyper.icu',
	integrations: [
		starlight({
			title: 'Keyper Docs',
			description: 'Official documentation for Keyper self-hosted credential management.',
			logo: {
				src: './src/assets/logo.png',
				alt: 'Keyper',
			},
			favicon: '/favicon.png',
			customCss: ['./src/styles/keyper-theme.css'],
			components: {
				Head: './src/components/Head.astro',
			},
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/pinkpixel-dev/keyper' },
				{ icon: 'external', label: 'Web App', href: 'https://app.keyper.icu' },
			],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Overview', slug: 'getting-started/overview' },
						{ label: 'Install and Run', slug: 'getting-started/install-and-run' },
						{
							label: 'Upgrading to 1.3.0',
							slug: 'getting-started/upgrading-to-1-3',
							badge: { text: 'Start here', variant: 'tip' },
						},
						{ label: 'Screenshots', slug: 'getting-started/screenshots' },
						{ label: 'Appearance Settings', slug: 'getting-started/appearance-settings' },
					],
				},
				{
					label: 'Architecture',
					items: [
						{ label: 'System Overview', slug: 'architecture/system-overview' },
						{ label: 'Runtime Flow', slug: 'architecture/runtime-flow' },
					],
				},
				{
					label: 'Security',
					items: [
						{ label: 'Security Model', slug: 'security/security-model' },
						{ label: 'Cryptography', slug: 'security/cryptography' },
					],
				},
				{
					label: 'Data',
					items: [
						{ label: 'Database Schema', slug: 'data/database-schema' },
						{ label: 'Credential Lifecycle', slug: 'data/credential-lifecycle' },
					],
				},
				{
					label: 'Operations',
					items: [
						{ label: 'Cloudflare Deployment', slug: 'operations/cloudflare-deployment' },
						{ label: 'Self-Hosting', slug: 'operations/self-hosting' },
						{ label: 'Neon Postgres', slug: 'operations/neon-postgres' },
						{ label: 'Troubleshooting', slug: 'operations/troubleshooting' },
					],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'Configuration', slug: 'reference/configuration' },
						{ label: 'Testing and Quality', slug: 'reference/testing-and-quality' },
						{ label: 'Source Map', slug: 'reference/source-map' },
					],
				},
			],
		}),
	],
});
