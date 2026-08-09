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
import setupSqlScript from '/supabase-setup.sql?raw';
import neonSetupSqlScript from '/neon-setup.sql?raw';
import updateSqlScript from '/update-db.sql?raw';
import UserSwitcher from '@/components/UserSwitcher';

interface DashboardSettingsProps {
 onUserContextChanged?: () => void;
}

export const DashboardSettings: React.FC<DashboardSettingsProps> = ({ onUserContextChanged}) => {
 const [showSetupSqlScript, setShowSetupSqlScript] = useState(false);
 const [showUpdateSqlScript, setShowUpdateSqlScript] = useState(false);
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

 const copyToClipboard = (text: string, label: string) => {
 navigator.clipboard.writeText(text);
 toast({
 title: 'Copied!',
 description: `${label} copied to clipboard.`,
});
};

 const activeSetupScript = dbProvider === 'neon' ? neonSetupSqlScript : setupSqlScript;
 const activeProviderLabel = dbProvider === 'neon' ? `Neon ${neonMode === 'local' ? 'Local' : 'Cloud'}` : 'Supabase';

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
 <Database className="h-4 w-4" />
 System Info
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
 <li>• Each username has its own `vault_config` row and its own encryption key material.</li>
 <li>• Switching users only changes which vault you are attempting to unlock.</li>
 <li>• The target user&apos;s passphrase is still required before any credentials become readable.</li>
 <li>• Emergency passphrase resets remain self-service through each user&apos;s bcrypt hash.</li>
 </ul>
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="database-sql" className="space-y-6">
 <Alert className="border-amber-500 bg-amber-950/20">
 <AlertTriangle className="h-4 w-4 text-amber-400" />
 <AlertDescription className="text-amber-200">
 New credential types (`document`, `misc`) require running the update SQL on existing databases.
 These features will not work until the update script is applied.
 </AlertDescription>
 </Alert>

 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Database className="h-5 w-5 text-primary" />
 Full Database Setup Script
 </CardTitle>
 <CardDescription>
 Use this when setting up a brand-new {activeProviderLabel} database for Keyper. (Postgres providers only — SQLite schema is created automatically.)
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="flex gap-3 flex-wrap">
 <Button
 variant="outline"
 onClick={() => window.open(dbProvider === 'neon' ? 'https://console.neon.tech' : 'https://supabase.com/dashboard', '_blank')}
 className="flex items-center gap-2"
 >
 <ExternalLink className="h-4 w-4" />
 Open {dbProvider === 'neon' ? 'Neon Console' : 'Supabase Dashboard'}
 </Button>
 <Button
 onClick={() => copyToClipboard(activeSetupScript, `${activeProviderLabel} setup SQL script`)}
 className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
 >
 <Copy className="h-4 w-4" />
 Copy Setup Script
 </Button>
 <Button
 variant="ghost"
 onClick={() => setShowSetupSqlScript((prev) => !prev)}
 className="text-primary hover:text-primary/80"
 >
 {showSetupSqlScript ? 'Hide Script' : 'View Script'}
 </Button>
 </div>

 {showSetupSqlScript && (
 <div className="bg-card p-4 rounded-lg max-h-56 overflow-y-auto border border-border">
 <pre className="text-xs text-foreground whitespace-pre-wrap">{activeSetupScript}</pre>
 </div>
 )}
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <RefreshCw className="h-5 w-5 text-green-400" />
 Existing Database Update Script
 </CardTitle>
 <CardDescription>
 Use this if you already have Keyper data and want to upgrade safely.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="flex gap-3 flex-wrap">
 <Button
 onClick={() => copyToClipboard(updateSqlScript, 'Database update SQL script')}
 className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
 >
 <Copy className="h-4 w-4" />
 Copy Update Script
 </Button>
 <Button
 variant="ghost"
 onClick={() => setShowUpdateSqlScript((prev) => !prev)}
 className="text-green-300 hover:text-green-200"
 >
 {showUpdateSqlScript ? 'Hide Script' : 'View Script'}
 </Button>
 </div>

 {showUpdateSqlScript && (
 <div className="bg-card p-4 rounded-lg max-h-56 overflow-y-auto border border-border">
 <pre className="text-xs text-foreground whitespace-pre-wrap">{updateSqlScript}</pre>
 </div>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="reset" className="space-y-6">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <RefreshCw className="h-5 w-5 text-orange-400" />
 Reset Local Configuration
 </CardTitle>
 <CardDescription>
 Clear local settings and force database reconfiguration
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-3">
 <p className="text-sm text-foreground">
 This will clear your database connection settings and require you to set them up again.
 </p>
 <Button
 onClick={handleResetLocalData}
 variant="outline"
 className="flex items-center gap-2 border-orange-500 text-orange-400 hover:bg-orange-500/10"
 >
 <Trash2 className="h-4 w-4" />
 Reset Local Configuration
 </Button>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Key className="h-5 w-5 text-blue-400" />
 Reset Master Passphrase
 </CardTitle>
 <CardDescription>
 Securely reset your master passphrase through your database (Your data remains encrypted)
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <Alert>
 <Info className="h-4 w-4" />
 <AlertDescription>
 <strong>Good News:</strong> Your encrypted data is safe! You can reset your passphrase by updating the <code>bcrypt_hash</code> value directly in your database.
 </AlertDescription>
 </Alert>

 <div className="space-y-4">
 <div className="space-y-2">
 <p className="text-sm font-medium text-foreground">
 To reset your master passphrase:
 </p>
 {dbProvider === 'sqlite' ? (
 <ol className="text-sm text-foreground space-y-2 list-decimal list-inside pl-4">
 <li>Visit <a href="https://bcrypt-generator.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">https://bcrypt-generator.com/</a></li>
 <li>Under"Text to Hash", enter your <strong>new desired passphrase</strong></li>
 <li>Click"Generate" and copy the resulting bcrypt hash</li>
 <li>Open your SQLite database file with a tool such as <a href="https://sqlitebrowser.org/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">DB Browser for SQLite</a></li>
 <li>Navigate to the <code>vault_config</code> table, find your user row</li>
 <li>Paste the new hash into the <code>bcrypt_hash</code> column and save</li>
 </ol>
 ) : dbProvider === 'neon' ? (
 <ol className="text-sm text-foreground space-y-2 list-decimal list-inside pl-4">
 <li>Visit <a href="https://bcrypt-generator.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">https://bcrypt-generator.com/</a></li>
 <li>Under"Text to Hash", enter your <strong>new desired passphrase</strong></li>
 <li>Click"Generate" and copy the resulting bcrypt hash</li>
 <li>{neonMode === 'local' ? 'Open a Postgres GUI or psql session connected to your Neon Local connection string' : 'Open the Neon Console SQL Editor or Table view'}</li>
 <li>Navigate to the <code>vault_config</code> table, find your user row</li>
 <li>Paste the new hash into the <code>bcrypt_hash</code> column and save</li>
 </ol>
 ) : (
 <ol className="text-sm text-foreground space-y-2 list-decimal list-inside pl-4">
 <li>Login to your <strong>Supabase Dashboard</strong></li>
 <li>Navigate to the <code>vault_config</code> table in the Table Editor</li>
 <li>Visit <a href="https://bcrypt-generator.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">https://bcrypt-generator.com/</a></li>
 <li>Under"Text to Hash", enter your <strong>new desired passphrase</strong></li>
 <li>Click"Generate" to create the hash</li>
 <li>Copy the generated hash</li>
 <li>Paste it into the <code>bcrypt_hash</code> column for your user row</li>
 <li>Save the changes</li>
 </ol>
 )}
 </div>

 <Alert>
 <AlertDescription>
 <strong>Security Note:</strong> It's impossible to convert a hash back to a string - your data remains secure!
 </AlertDescription>
 </Alert>

 <div className="p-4 bg-muted/50 rounded-lg border border-blue-500/20">
 <p className="text-sm text-blue-200 font-medium mb-2">Important:</p>
 <ul className="text-xs text-foreground space-y-1">
 <li>• It's not possible to <strong>view/see</strong> your current master passphrase</li>
 <li>• You can only <strong>update/change</strong> your passphrase using this method</li>
 <li>• Your encrypted credentials remain completely safe during this process</li>
 </ul>
 </div>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Trash2 className="h-5 w-5 text-red-400" />
 Complete Browser Reset
 </CardTitle>
 <CardDescription>
 Instructions to completely reset Keyper in your browser
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-3">
 <p className="text-sm text-foreground">
 For a complete reset, follow these browser-specific steps:
 </p>
 <Button
 onClick={handleClearBrowserCache}
 variant="outline"
 className="flex items-center gap-2"
 >
 <RefreshCw className="h-4 w-4" />
 Copy Reset Instructions
 </Button>
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="system" className="space-y-6">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Database className="h-5 w-5 text-primary" />
 System Information
 </CardTitle>
 <CardDescription>
 Current system status and configuration
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="p-4 bg-muted/50 rounded-lg">
 <div className="space-y-1">
 <Label className="text-sm font-medium">Current User</Label>
 <p className="text-sm text-muted-foreground font-mono">{currentUser}</p>
 </div>
 </div>
 <div className="p-4 bg-muted/50 rounded-lg">
 <div className="space-y-1">
 <Label className="text-sm font-medium">Security Level</Label>
 <p className="text-sm text-green-400 font-medium">
 Maximum
 </p>
 </div>
 </div>
 <div className="p-4 bg-muted/50 rounded-lg">
 <div className="space-y-1">
 <Label className="text-sm font-medium">Master Passphrase</Label>
 <p className="text-sm text-blue-400 font-mono">Bcrypt-Only Secure Reset</p>
 </div>
 </div>
 <div className="p-4 bg-muted/50 rounded-lg">
 <div className="space-y-1">
 <Label className="text-sm font-medium">App Version</Label>
 <p className="text-sm text-muted-foreground">0.1.0</p>
 </div>
 </div>
 <div className="p-4 bg-muted/50 rounded-lg">
 <div className="space-y-1">
 <Label className="text-sm font-medium">Database Provider</Label>
 <p className="text-sm text-muted-foreground font-mono">
 {dbProvider === 'neon' ? activeProviderLabel : dbProvider === 'sqlite' ? 'SQLite' : 'Supabase'}
 </p>
 </div>
 </div>
 <div className="p-4 bg-muted/50 rounded-lg">
 <div className="space-y-1">
 <Label className="text-sm font-medium">Mode</Label>
 <p className="text-sm text-muted-foreground">Self-Hosted</p>
 </div>
 </div>
 </div>

 <Separator />

 <div className="space-y-2">
 <Label className="text-sm font-medium">Security Architecture</Label>
 <p className="text-sm text-muted-foreground">
 Enhanced security model: Admin privileges removed, bcrypt-only master passphrase with user-controlled reset.
 All users operate within their isolated encrypted vaults with zero-knowledge architecture.
 </p>
 <div className="mt-2 p-3 bg-green-500/10 rounded border border-green-500/20">
 <p className="text-xs text-green-300">
 🔐 For emergency passphrase reset instructions: <span className="font-mono text-blue-300">/docs/EMERGENCY_PASSPHRASE_RESET.md</span>
 </p>
 </div>
 </div>
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>
 </div>
 );
};
