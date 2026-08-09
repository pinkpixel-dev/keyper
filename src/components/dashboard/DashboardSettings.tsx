import React, { useState} from 'react';
import { useTheme} from 'next-themes';
import { Button} from '@/components/ui/button';
import { Label} from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import { Alert, AlertDescription} from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import { Separator} from '@/components/ui/separator';
import {
 Shield,
 Trash2,
 Settings,
 RefreshCw,
 AlertTriangle,
 Info,
 Database,
 Key,
 Users,
 Copy,
 ExternalLink,
 Palette,
 Circle,
 Moon,
 Sun,
 Monitor
} from 'lucide-react';
import { useToast} from '@/hooks/use-toast';
import { getCurrentUsername, clearSupabaseCredentials, getDatabaseProvider, getNeonMode} from '@/integrations/supabase/client';
import { THEME_OPTIONS} from '@/lib/theme-options';
import UserSwitcher from '@/components/UserSwitcher';
import DatabaseSqlCard from '@/components/dashboard/settings/DatabaseSqlCard';
import ChangePassphraseCard from '@/components/dashboard/settings/ChangePassphraseCard';
import ResetVaultCard from '@/components/dashboard/settings/ResetVaultCard';
import SystemInfoCard from '@/components/dashboard/settings/SystemInfoCard';
import AboutCard from '@/components/dashboard/settings/AboutCard';

interface DashboardSettingsProps {
 onUserContextChanged?: () => void;
}

export const DashboardSettings: React.FC<DashboardSettingsProps> = ({ onUserContextChanged}) => {
 const { toast} = useToast();
 const currentUser = getCurrentUsername();
 const dbProvider = getDatabaseProvider();
 const neonMode = getNeonMode();

 const { theme, setTheme} = useTheme();
 const [currentFont, setCurrentFont] = useState(() => localStorage.getItem('keyper-font-preference') || 'font-sans');

 const themeIcons = {
 light: Sun,
 dark: Moon,
 system: Monitor,
 'theme-charcoal': Moon,
 'theme-light-gray': Circle,
 'theme-medium-gray': Circle,
 'theme-warm-light': Sun,
 'theme-blue': Palette,
 'theme-midnight-blue': Moon,
 'theme-deep-purple': Moon,
};

 const handleFontChange = (fontClass: string) => {
 localStorage.setItem('keyper-font-preference', fontClass);
 setCurrentFont(fontClass);
 window.dispatchEvent(new CustomEvent('font-change', { detail: fontClass}));
 toast({
 title:"Font Updated",
 description:"Your font preference has been saved.",
});
};

 const handleResetLocalData = () => {
 if (confirm('This will clear all local configuration and require database setup again. Continue?')) {
 clearSupabaseCredentials();
 localStorage.clear();
 toast({
 title:"Local Data Cleared",
 description:"All local configuration has been reset. Please refresh the page.",
});
 setTimeout(() => window.location.reload(), 2000);
}
};

 const handleClearBrowserCache = () => {
 const instructions = `To completely reset Keyper:

1. Open browser settings
2. Go to Privacy/Security section
3. Clear browsing data/storage
4. Select"Cookies and site data" and"Cached files"
5. Choose"All time" as time range
6. Click Clear data
7. Refresh this page`;

 navigator.clipboard.writeText(instructions);
 toast({
 title:"Instructions Copied",
 description:"Browser cache clearing instructions copied to clipboard",
});
};


 return (
 <div className="max-w-4xl mx-auto p-6 space-y-6">
 <div className="flex items-center gap-3 mb-6">
 <Settings className="h-8 w-8 text-primary" />
 <div>
 <h1 className="text-3xl font-bold text-foreground">Dashboard Settings</h1>
 <p className="text-muted-foreground">User management and system controls</p>
 </div>
 </div>

 <Tabs defaultValue="users" className="space-y-6">
 <TabsList className="grid w-full grid-cols-5">
 <TabsTrigger value="users" className="flex items-center gap-2">
 <Users className="h-4 w-4" />
 User Management
 </TabsTrigger>
 <TabsTrigger value="database-sql" className="flex items-center gap-2">
 <Database className="h-4 w-4" />
 Database SQL
 </TabsTrigger>
 <TabsTrigger value="reset" className="flex items-center gap-2">
 <RefreshCw className="h-4 w-4" />
 Reset Options
 </TabsTrigger>
 <TabsTrigger value="system" className="flex items-center gap-2">
 <Info className="h-4 w-4" />
 About
 </TabsTrigger>
 <TabsTrigger value="appearance" className="flex items-center gap-2">
 <Palette className="h-4 w-4" />
 Appearance
 </TabsTrigger>
 </TabsList>

 <TabsContent value="appearance" className="space-y-6">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2 text-primary">
 <Palette className="h-5 w-5" />
 Theme & Appearance
 </CardTitle>
 <CardDescription>
 Customize how Keyper looks and feels
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-6">
 <div className="space-y-4">
 <div className="space-y-2">
 <Label>Theme Preference</Label>
 <p className="text-sm text-muted-foreground">Choose a saved theme or let Keyper follow your system preference.</p>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
 {THEME_OPTIONS.map((themeOption) => {
 const Icon = themeIcons[themeOption.value] || Palette;
 const isActive = theme === themeOption.value;

 return (
 <Button
 key={themeOption.value}
 type="button"
 variant={isActive ? 'default' : 'outline'}
 onClick={() => setTheme(themeOption.value)}
 aria-pressed={isActive}
 className="h-auto min-h-20 justify-start gap-3 whitespace-normal p-3 text-left"
 >
 <span className={`h-9 w-9 shrink-0 rounded-md border border-border ${themeOption.swatchClass}`} aria-hidden="true" />
 <span className="min-w-0 flex-1">
 <span className="flex items-center gap-2 font-medium leading-tight">
 <Icon className="h-4 w-4 shrink-0" />
 {themeOption.label}
 </span>
 <span className="mt-1 block text-xs leading-snug opacity-80">
 {themeOption.description}
 </span>
 </span>
 </Button>
);
})}
 </div>
 </div>

 <Separator />

 <div className="space-y-2">
 <Label>Application Font</Label>
 <p className="text-sm text-muted-foreground">Choose a custom font family for the application text.</p>
 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-2">
 <Button
 variant={currentFont === 'font-sans' ? 'default' : 'outline'}
 onClick={() => handleFontChange('font-sans')}
 className="justify-start font-sans"
 >
 Inter (Default Sans)
 </Button>
 <Button
 variant={currentFont === 'font-roboto' ? 'default' : 'outline'}
 onClick={() => handleFontChange('font-roboto')}
 className="justify-start font-roboto"
 >
 Roboto
 </Button>
 <Button
 variant={currentFont === 'font-outfit' ? 'default' : 'outline'}
 onClick={() => handleFontChange('font-outfit')}
 className="justify-start font-outfit"
 >
 Outfit
 </Button>
 <Button
 variant={currentFont === 'font-serif' ? 'default' : 'outline'}
 onClick={() => handleFontChange('font-serif')}
 className="justify-start font-serif"
 >
 Playfair Display
 </Button>
 <Button
 variant={currentFont === 'font-mono' ? 'default' : 'outline'}
 onClick={() => handleFontChange('font-mono')}
 className="justify-start font-mono"
 >
 Fira Code (Mono)
 </Button>
 </div>
 </div>
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="users" className="space-y-6">
 <UserSwitcher onUserSwitched={onUserContextChanged} />

 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2 text-blue-400">
 <Shield className="h-5 w-5" />
 Multi-User Security Model
 </CardTitle>
 <CardDescription>
 The instance supports multiple independent vaults without any privileged bypass.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <Alert>
 <Shield className="h-4 w-4" />
 <AlertDescription>
 Current user: <strong>{currentUser}</strong>. Security level: <strong>Maximum</strong>.
 </AlertDescription>
 </Alert>
 <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
 <p className="mb-2 text-sm font-medium text-blue-200">How it works:</p>
 <ul className="space-y-1 text-xs text-foreground">
 <li>• Each account has its own vault and its own encryption key material.</li>
 <li>• On Supabase, the database keeps each account to its own rows. It is not the app choosing what to show you.</li>
 <li>• Signing in gets you your encrypted rows. Your master passphrase is still required to read them.</li>
 <li>• There is no passphrase reset. It can be changed if you know the current one, under the Reset tab.</li>
 </ul>
 </div>
 </CardContent>
 </Card>
 </TabsContent>

      <TabsContent value="database-sql" className="space-y-6">
        <DatabaseSqlCard />
      </TabsContent>

      <TabsContent value="reset" className="space-y-6">
        <ChangePassphraseCard />
        <ResetVaultCard />
      </TabsContent>

      <TabsContent value="system" className="space-y-6">
        <AboutCard />
        <SystemInfoCard />
      </TabsContent>
 </Tabs>
 </div>
 );
};
