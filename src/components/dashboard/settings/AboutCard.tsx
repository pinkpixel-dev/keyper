/**
 * About Keyper: version, links, support.
 *
 * The version comes from app-info.ts, which reads package.json at build time.
 * Do not hardcode it here.
 *
 * Made with ❤️ by Pink Pixel ✨
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  APP_LINKS,
  APP_NAME,
  APP_VERSION,
  LICENSE,
  MAKER,
  SUPPORT_EMAIL,
} from '@/lib/app-info';
import {
  BookOpen,
  Bug,
  ExternalLink,
  Github,
  Globe,
  Heart,
  Info,
  Mail,
  ScrollText,
  ShieldCheck,
} from 'lucide-react';

const LINKS = [
  { label: 'Website', href: APP_LINKS.website, icon: Globe },
  { label: 'Documentation', href: APP_LINKS.docs, icon: BookOpen },
  { label: 'Security model', href: APP_LINKS.securityModel, icon: ShieldCheck },
  { label: 'GitHub', href: APP_LINKS.github, icon: Github },
  { label: 'Report an issue', href: APP_LINKS.issues, icon: Bug },
  { label: 'Changelog', href: APP_LINKS.changelog, icon: ScrollText },
] as const;

export default function AboutCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5 text-primary" aria-hidden="true" />
          About {APP_NAME}
        </CardTitle>
        <CardDescription>Version, links and where to get help.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <img
            src="/logo.png"
            alt=""
            className="h-10 w-10 rounded-lg object-contain"
            aria-hidden="true"
          />
          <div>
            <p className="font-medium">{APP_NAME}</p>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <Badge variant="secondary" className="font-mono">
                v{APP_VERSION}
              </Badge>
              <span className="text-xs text-muted-foreground">{LICENSE} licensed</span>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          A self-hosted credential manager. Your secrets are encrypted in your
          browser before they reach the database, under a key only your master
          passphrase can unlock.
        </p>

        <Separator />

        <div>
          <h3 className="mb-2 text-sm font-medium">Links</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {LINKS.map(({ label, href, icon: Icon }) => (
              <Button
                key={label}
                asChild
                variant="outline"
                size="sm"
                className="justify-start"
              >
                <a href={href} target="_blank" rel="noreferrer noopener">
                  <Icon className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{label}</span>
                  <ExternalLink className="ml-auto h-3 w-3 shrink-0 opacity-50" aria-hidden="true" />
                </a>
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="mb-2 text-sm font-medium">Support</h3>
          <p className="mb-2 text-sm text-muted-foreground">
            Bug reports and feature requests are best on GitHub, where other people
            can see them. For anything else, email us.
          </p>
          <Button asChild variant="outline" size="sm" className="justify-start">
            <a href={`mailto:${SUPPORT_EMAIL}`}>
              <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
              {SUPPORT_EMAIL}
            </a>
          </Button>
          <p className="pt-2 text-xs text-muted-foreground">
            Never include your master passphrase, connection strings, or the
            contents of your <code>vault_config</code> table in a support message.
          </p>
        </div>

        <Separator />

        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          Made with <Heart className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> by{' '}
          <a
            href={MAKER.website}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary underline-offset-4 hover:underline"
          >
            {MAKER.name}
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
