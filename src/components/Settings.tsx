import React, { useState} from 'react';
import { Button} from '@/components/ui/button';
import { Input} from '@/components/ui/input';
import { Label} from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import { Alert, AlertDescription} from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import { Badge} from '@/components/ui/badge';
import { Separator} from '@/components/ui/separator';
// Imported as raw text so the SQL users copy from Settings is byte-for-byte the
// script in the repo, rather than a duplicate that can fall out of date.
import supabaseSetupSql from '../../supabase-setup.sql?raw';
import {
 Settings as SettingsIcon,
 Database,
 TestTube,
 CheckCircle,
 XCircle,
 AlertCircle,
 ExternalLink,
 Copy,
 RefreshCw,
 Trash2,
 RotateCcw,
 ArrowLeft,
 Shield,
 Info
} from 'lucide-react';
import { useToast} from '@/hooks/use-toast';
import {
 DB_PROVIDER_KEY,
 NEON_CONNECTION_STRING_KEY,
 NEON_MODE_KEY,
 SQLITE_DB_PATH_KEY,
 type DatabaseProvider,
 isElectronApp,
 saveDatabaseProvider,
 saveSupabaseCredentials,
 clearSupabaseCredentials,
 clearNeonCredentials,
 clearSqliteDatabasePath,
 testSupabaseProviderConnection,
 testNeonProviderConnection,
 saveNeonCredentials,
 testSqliteProviderConnection,
 initializeSqliteProvider,
 refreshSupabaseClient,
 SUPABASE_URL_KEY,
 SUPABASE_KEY_KEY,
 SUPABASE_USERNAME_KEY
} from '@/integrations/supabase/client';
import neonSetupSqlScript from '/neon-setup.sql?raw';

interface SettingsProps {
 onConfigurationComplete?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onConfigurationComplete}) => {
 const runningInElectron = isElectronApp();
 const [databaseProvider, setDatabaseProvider] = useState<DatabaseProvider>(() => {
 const provider = localStorage.getItem(DB_PROVIDER_KEY);
 return provider === 'sqlite' || provider === 'neon' ? provider : 'supabase';
});
 const [sqliteDbPath, setSqliteDbPath] = useState<string>(() => {
 return localStorage.getItem(SQLITE_DB_PATH_KEY) || '';
});
 // Initialize state directly from localStorage like the reference app
 const [supabaseUrl, setSupabaseUrl] = useState<string>(() => {
 return localStorage.getItem(SUPABASE_URL_KEY) || '';
});
 const [supabaseKey, setSupabaseKey] = useState<string>(() => {
 return localStorage.getItem(SUPABASE_KEY_KEY) || '';
});
 const [neonConnectionString, setNeonConnectionString] = useState<string>(() => {
 return localStorage.getItem(NEON_CONNECTION_STRING_KEY) || '';
});
 const [neonMode, setNeonMode] = useState<'cloud' | 'local'>(() => {
 return localStorage.getItem(NEON_MODE_KEY) === 'local' ? 'local' : 'cloud';
});
 const [username, setUsername] = useState<string>(() => {
 return localStorage.getItem(SUPABASE_USERNAME_KEY) || '';
});
 const [isConnecting, setIsConnecting] = useState(false);
 const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
 const [errorMessage, setErrorMessage] = useState('');
 const [showSqlScript, setShowSqlScript] = useState(false);
 const [showUpdateSqlScript, setShowUpdateSqlScript] = useState(false);
 const { toast} = useToast();

 // No need for useEffect - credentials are loaded directly in state initializers

 const testConnection = async () => {
 setIsConnecting(true);
 setConnectionStatus('idle');
 setErrorMessage('');

 try {
 if (databaseProvider === 'sqlite') {
 const sqliteResult = await testSqliteProviderConnection(sqliteDbPath.trim() || undefined);
 if (sqliteResult.error) {
 throw new Error(sqliteResult.error.message);
}

 const finalUsername = username.trim() || 'self-hosted-user';
 saveDatabaseProvider('sqlite');
 if (sqliteResult.data?.path) {
 localStorage.setItem(SQLITE_DB_PATH_KEY, sqliteResult.data.path);
} else if (sqliteDbPath.trim()) {
 localStorage.setItem(SQLITE_DB_PATH_KEY, sqliteDbPath.trim());
} else {
 localStorage.removeItem(SQLITE_DB_PATH_KEY);
}
 localStorage.setItem(SUPABASE_USERNAME_KEY, finalUsername);
} else if (databaseProvider === 'neon') {
 if (!neonConnectionString.trim()) {
 throw new Error('Please enter your Neon connection string');
}

 const neonResult = await testNeonProviderConnection(neonConnectionString.trim(), neonMode);
 if (neonResult.error) {
 throw new Error(neonResult.error.message);
}

 const finalUsername = username.trim() || 'self-hosted-user';
 saveNeonCredentials(neonConnectionString.trim(), neonMode, finalUsername);
} else {
 if (!supabaseUrl || !supabaseKey) {
 throw new Error('Please enter both Supabase URL and API key');
}

 const { error} = await testSupabaseProviderConnection(supabaseUrl, supabaseKey);

 if (error) {
 throw new Error(error.message);
}

 const finalUsername = username.trim() || 'self-hosted-user';
 saveSupabaseCredentials(supabaseUrl.trim(), supabaseKey.trim(), finalUsername);
}

 setConnectionStatus('success');
 toast({
 title:"Connection Successful! 🎉",
 description: databaseProvider === 'sqlite'
 ? 'Successfully connected to your SQLite database.'
 : databaseProvider === 'neon'
 ? `Successfully connected to Neon ${neonMode === 'local' ? 'Local' : 'Cloud'}.`
 : 'Successfully connected to your Supabase instance.',
});
} catch (error) {
 console.error('Connection test failed:', error);
 setConnectionStatus('error');
 setErrorMessage(error instanceof Error ? error.message : 'Connection failed');
 toast({
 title:"Connection Failed ❌",
 description:"Please check your credentials and database setup.",
 variant:"destructive",
});
} finally {
 setIsConnecting(false);
}
};

 const clearConfiguration = () => {
 clearSupabaseCredentials();
 clearNeonCredentials();
 clearSqliteDatabasePath();
 localStorage.removeItem(DB_PROVIDER_KEY);
 setSupabaseUrl('');
 setSupabaseKey('');
 setNeonConnectionString('');
 setNeonMode('cloud');
 setSqliteDbPath('');
 setDatabaseProvider('supabase');
 setUsername('');
 setConnectionStatus('idle');
 setErrorMessage('');
 refreshSupabaseClient();
 toast({
 title:"Configuration Cleared",
 description:"Database configuration has been cleared. You can now enter new credentials.",
});
};

 const copyToClipboard = (text: string, label: string) => {
 navigator.clipboard.writeText(text);
 toast({
 title:"Copied!",
 description: `${label} copied to clipboard.`,
});
};

 const refreshPage = () => {
 window.location.reload();
};

 // Manual save and close function
 const handleSaveAndClose = () => {
 const finalUsername = username.trim() || 'self-hosted-user';
 if (databaseProvider === 'sqlite') {
 saveDatabaseProvider('sqlite');
 localStorage.setItem(SUPABASE_USERNAME_KEY, finalUsername);
 if (sqliteDbPath.trim()) {
 localStorage.setItem(SQLITE_DB_PATH_KEY, sqliteDbPath.trim());
} else {
 localStorage.removeItem(SQLITE_DB_PATH_KEY);
}
 void initializeSqliteProvider(sqliteDbPath.trim() || undefined);
 toast({
 title:"Settings Saved! 💾",
 description:"SQLite has been configured for this device.",
});
} else if (databaseProvider === 'neon' && neonConnectionString.trim()) {
 saveNeonCredentials(neonConnectionString.trim(), neonMode, finalUsername);
 toast({
 title:"Settings Saved! 💾",
 description:`Neon ${neonMode === 'local' ? 'Local' : 'Cloud'} has been configured.`,
});
} else if (supabaseUrl && supabaseKey) {
 saveSupabaseCredentials(supabaseUrl, supabaseKey, finalUsername);
 toast({
 title:"Settings Saved! 💾",
 description:"Your configuration has been saved.",
});
}
 refreshSupabaseClient();
 onConfigurationComplete?.();
};

 // Manual close without saving
 const handleCloseWithoutSaving = () => {
 if (onConfigurationComplete) {
 onConfigurationComplete();
}
};

  // The setup SQL shown here is read straight from the shipped
  // supabase-setup.sql at build time. It used to be a second copy pasted into
  // this component, which drifted: the file was fixed while the copy users
  // actually paste into the SQL editor still created the old wide-open
  // policies. One source, no drift.
  const sqlScript = supabaseSetupSql;

 const updateSqlScript = `-- Add new credential types for document uploads and miscellaneous sensitive values
-- Run this in Supabase SQL Editor for existing deployments.

ALTER TABLE credentials
 DROP CONSTRAINT IF EXISTS credentials_credential_type_check;

ALTER TABLE credentials
 ADD CONSTRAINT credentials_credential_type_check
 CHECK (
 credential_type IN (
 'api_key',
 'login',
 'secret',
 'token',
 'certificate',
 'document',
 'misc'
 )
 );`;

 return (
 <div className="max-w-4xl mx-auto p-6 space-y-6">
 <div className="flex items-center gap-3 mb-6">
 <SettingsIcon className="h-8 w-8 text-primary" />
 <div>
 <h1 className="text-3xl font-bold text-foreground">Keyper Settings</h1>
 <p className="text-muted-foreground">Choose and configure your Keyper database provider</p>
 </div>
 </div>

 <Tabs defaultValue="database" className="space-y-6">
 <TabsList className="grid w-full grid-cols-3">
 <TabsTrigger value="database" className="flex items-center gap-2">
 <Database className="h-4 w-4" />
 Database Setup
 </TabsTrigger>
 <TabsTrigger value="security" className="flex items-center gap-2">
 <Shield className="h-4 w-4" />
 Security
 </TabsTrigger>
 <TabsTrigger value="about" className="flex items-center gap-2">
 <SettingsIcon className="h-4 w-4" />
 About
 </TabsTrigger>
 </TabsList>

 <TabsContent value="database" className="space-y-6">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Database className="h-5 w-5 text-primary" />
 Database Provider Configuration
 </CardTitle>
 <CardDescription>
 Configure Supabase or Neon for hosted Postgres storage, or SQLite for local-first storage on this device.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="database-provider">Database Provider</Label>
 <select
 id="database-provider"
 value={databaseProvider}
 onChange={(e) => {
 const provider = e.target.value === 'sqlite' || e.target.value === 'neon' ? e.target.value : 'supabase';
 setDatabaseProvider(provider);
 setConnectionStatus('idle');
 setErrorMessage('');
}}
 className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
 >
 <option value="supabase">Supabase (Web/PWA + Desktop)</option>
 <option value="neon">Neon Postgres (Cloud or Local)</option>
 <option value="sqlite">SQLite (Local-First: Browser + Desktop)</option>
 </select>
 </div>

 {databaseProvider === 'sqlite' && (
 <Alert className="border-amber-500 bg-amber-950/20">
 <AlertCircle className="h-4 w-4 text-amber-400" />
 <AlertDescription className="text-amber-200">
 SQLite keeps data local to this device. In the browser or PWA it is stored locally in browser storage.
 In the desktop app it can also use a file on disk.
 </AlertDescription>
 </Alert>
 )}

 {databaseProvider === 'neon' && (
 <Alert className="border-blue-500 bg-blue-950/20">
 <AlertCircle className="h-4 w-4 text-blue-400" />
 <AlertDescription className="text-blue-100">
 Neon connection strings include a database role password. Keyper stores this string locally in this browser or Electron profile.
 </AlertDescription>
 </Alert>
 )}

 {databaseProvider === 'sqlite' ? (
 <div className="space-y-2">
 <Label htmlFor="sqlite-db-path">
 {runningInElectron ? 'SQLite Database File (Optional)' : 'SQLite Database Name (Optional)'}
 </Label>
 <Input
 id="sqlite-db-path"
 type="text"
 placeholder={runningInElectron ? 'Default app data path will be used if empty' : 'Default browser-local database will be used if empty'}
 value={sqliteDbPath}
 onChange={(e) => setSqliteDbPath(e.target.value)}
 className="font-mono"
 />
 <p className="text-sm text-muted-foreground">
 {runningInElectron
 ? 'Leave empty to use Keyper\'s default local data directory.'
 : 'Leave empty to use Keyper\'s default browser-local SQLite database. A custom name creates a separate local database in this browser.'}
 </p>
 </div>
 ) : databaseProvider === 'neon' ? (
 <>
 <div className="space-y-2">
 <Label htmlFor="neon-mode">Neon Mode</Label>
 <select
 id="neon-mode"
 value={neonMode}
 onChange={(e) => setNeonMode(e.target.value === 'local' ? 'local' : 'cloud')}
 className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
 >
 <option value="cloud">Neon Cloud</option>
 <option value="local">Neon Local Docker</option>
 </select>
 <p className="text-sm text-muted-foreground">
 {neonMode === 'local'
 ? 'Start the official Neon Local Docker container first, then paste its local Postgres connection string.'
 : 'Use either a pooled or direct Neon Postgres connection string from the Neon dashboard.'}
 </p>
 </div>

 <div className="space-y-2">
 <Label htmlFor="neon-connection-string">Neon Connection String</Label>
 <Input
 id="neon-connection-string"
 type="password"
 placeholder={neonMode === 'local' ? 'postgres://neon:npg@localhost:5432/neondb' : 'postgresql://user:password@ep-example.us-east-2.aws.neon.tech/neondb?sslmode=require'}
 value={neonConnectionString}
 onChange={(e) => setNeonConnectionString(e.target.value)}
 className="font-mono"
 />
 <p className="text-sm text-muted-foreground">
 For Neon Local with the serverless driver, Keyper derives the local HTTP endpoint from this host and port.
 </p>
 </div>

 <div className="space-y-2">
 <Label htmlFor="username">Username</Label>
 <Input
 id="username"
 type="text"
 placeholder="e.g., john, admin, team1 (leave empty for default)"
 value={username}
 onChange={(e) => setUsername(e.target.value)}
 className="font-mono"
 />
 <p className="text-sm text-muted-foreground">
 Usernames separate vaults inside your Neon database, and each one needs its
 own passphrase. This is organisation, not a security boundary: anyone holding
 the connection string can reach every user&apos;s rows regardless.
 </p>
 </div>
 </>
 ) : (
 <>
 <div className="space-y-2">
 <Label htmlFor="supabase-url">Supabase Project URL</Label>
 <Input
 id="supabase-url"
 type="url"
 placeholder="https://your-project.supabase.co"
 value={supabaseUrl}
 onChange={(e) => setSupabaseUrl(e.target.value)}
 className="font-mono"
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="supabase-key">Supabase Anon or Publishable Key</Label>
 <Input
 id="supabase-key"
 type="password"
 placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 value={supabaseKey}
 onChange={(e) => setSupabaseKey(e.target.value)}
 className="font-mono"
 />
 </div>

 {/* No username field here on purpose. On Supabase your identity is
 your account, and separation is enforced by the database against
 auth.uid(). A username box would imply you can separate users by
 typing a different name, which is exactly the assumption that made
 older versions insecure. */}
 <Alert>
 <Info className="h-4 w-4" />
 <AlertDescription className="text-sm">
 <strong>Multiple users:</strong> each person signs up with their own
 email and gets their own vault. The database enforces the separation,
 so nobody can reach another account&apos;s credentials. Sign out and sign
 in to switch between them.
 </AlertDescription>
 </Alert>
 </>
 )}

 {databaseProvider === 'sqlite' && (
 <div className="space-y-2">
 <Label htmlFor="username">Username</Label>
 <Input
 id="username"
 type="text"
 placeholder="e.g., john, admin, team1 (leave empty for default)"
 value={username}
 onChange={(e) => setUsername(e.target.value)}
 className="font-mono"
 />
 <p className="text-sm text-muted-foreground">
 Usernames separate vaults inside your local SQLite file, and each one needs
 its own passphrase. Change this to switch users. The file itself is protected
 by your device, not by a login.
 </p>
 </div>
 )}

 <div className="flex gap-3 pt-4">
 <Button
 onClick={testConnection}
 disabled={
 isConnecting ||
 (databaseProvider === 'supabase' && (!supabaseUrl || !supabaseKey)) ||
 (databaseProvider === 'neon' && !neonConnectionString.trim())
}
 className="flex items-center gap-2"
 >
 {isConnecting ? (
 <RefreshCw className="h-4 w-4 animate-spin" />
 ) : (
 <TestTube className="h-4 w-4" />
 )}
 {isConnecting ? 'Testing...' : 'Test Connection'}
 </Button>

 <Button
 variant="outline"
 onClick={clearConfiguration}
 className="flex items-center gap-2"
 >
 <Trash2 className="h-4 w-4" />
 Clear
 </Button>
 </div>

 {/* Save and Close Actions */}
 <div className="flex gap-3 pt-6 border-t border-border">
 <Button
 onClick={handleSaveAndClose}
 className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
 disabled={
 (databaseProvider === 'supabase' && (!supabaseUrl || !supabaseKey)) ||
 (databaseProvider === 'neon' && !neonConnectionString.trim())
}
 >
 <CheckCircle className="h-4 w-4" />
 Save & Close
 </Button>

 <Button
 variant="outline"
 onClick={handleCloseWithoutSaving}
 className="flex items-center gap-2"
 >
 <ArrowLeft className="h-4 w-4" />
 Close
 </Button>

 <Button
 variant="outline"
 onClick={refreshPage}
 className="flex items-center gap-2"
 >
 <RotateCcw className="h-4 w-4" />
 Refresh App
 </Button>
 </div>

 {connectionStatus !== 'idle' && (
 <Alert className={connectionStatus === 'success' ? 'border-green-500' : 'border-red-500'}>
 <div className="flex items-center gap-2">
 {connectionStatus === 'success' ? (
 <CheckCircle className="h-4 w-4 text-green-500" />
 ) : (
 <XCircle className="h-4 w-4 text-red-500" />
 )}
 <AlertDescription>
 {connectionStatus === 'success'
 ? databaseProvider === 'sqlite'
 ? 'Successfully connected to SQLite! Your local database is ready.'
 : databaseProvider === 'neon'
 ? `Successfully connected to Neon ${neonMode === 'local' ? 'Local' : 'Cloud'}! Your Postgres database is ready.`
 : 'Successfully connected to Supabase! Your credentials are saved.'
 : `Connection failed: ${errorMessage}`
}
 </AlertDescription>
 </div>
 </Alert>
 )}
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <AlertCircle className="h-5 w-5 text-yellow-400" />
 Database Setup Required
 </CardTitle>
 <CardDescription>
 Follow setup instructions for your selected provider.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 {databaseProvider === 'sqlite' ? (
 <>
 <div className="space-y-3">
 <p className="text-sm text-foreground">
 <strong>Step 1:</strong> Choose SQLite as your provider for local-first storage.
 </p>
 <p className="text-sm text-foreground">
 <strong>Step 2:</strong> {runningInElectron ? 'Optionally set a database file path, or leave it empty to use the default local path.' : 'Optionally enter a database name, or leave it empty to use the default browser-local database.'}
 </p>
 <p className="text-sm text-foreground">
 <strong>Step 3:</strong> Click <strong>Test Connection</strong>. Keyper will auto-create the SQLite schema locally for you.
 </p>
 <p className="text-sm text-foreground">
 <strong>Step 4:</strong> Save your configuration and continue into the vault.
 </p>
 </div>
 <Alert className="border-amber-500 bg-amber-950/20">
 <AlertCircle className="h-4 w-4 text-amber-400" />
 <AlertDescription className="text-amber-200">
 SQLite stays local to the current device. Browser/PWA usage stores the database locally in that browser, while the desktop app can also target a file on disk.
 </AlertDescription>
 </Alert>
 </>
 ) : databaseProvider === 'neon' ? (
 <>
 <div className="space-y-3">
 <p className="text-sm text-foreground">
 <strong>Step 1:</strong> {neonMode === 'local' ? 'Start the official Neon Local Docker container.' : 'Create or open your Neon project.'}
 </p>
 <p className="text-sm text-foreground">
 <strong>Step 2:</strong> Copy your {neonMode === 'local' ? 'Neon Local' : 'Neon Cloud'} connection string into Keyper.
 </p>
 <p className="text-sm text-foreground">
 <strong>Step 3:</strong> Run the Neon setup script below in the Neon SQL Editor or a Postgres client connected to Neon.
 </p>
 <p className="text-sm text-foreground">
 <strong>Step 4:</strong> Test the connection, save your configuration, and continue into the vault.
 </p>
 </div>

 <Alert className="border-blue-500 bg-blue-950/20">
 <AlertCircle className="h-4 w-4 text-blue-400" />
 <AlertDescription className="text-blue-100">
 Neon Local uses Docker to expose a local Postgres endpoint while Neon manages the branch behind it. Keyper only connects to the string you provide.
 </AlertDescription>
 </Alert>

 <div className="flex gap-3 flex-wrap">
 <Button
 variant="outline"
 onClick={() => window.open('https://console.neon.tech', '_blank')}
 className="flex items-center gap-2"
 >
 <ExternalLink className="h-4 w-4" />
 Open Neon Console
 </Button>

 <Button
 onClick={() => copyToClipboard(neonSetupSqlScript, 'Neon setup SQL script')}
 className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
 >
 <Copy className="h-4 w-4" />
 Copy Neon SQL Script
 </Button>
 </div>

 {showSqlScript && (
 <div className="mt-4">
 <Label className="text-sm font-medium mb-2 block">Neon SQL Script Preview:</Label>
 <div className="bg-card p-4 rounded-lg max-h-40 overflow-y-auto">
 <pre className="text-xs text-foreground whitespace-pre-wrap">
 {neonSetupSqlScript.substring(0, 500)}...
 </pre>
 </div>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => setShowSqlScript(false)}
 className="mt-2"
 >
 Hide Preview
 </Button>
 </div>
 )}

 {!showSqlScript && (
 <Button
 variant="ghost"
 size="sm"
 onClick={() => setShowSqlScript(true)}
 className="text-primary hover:text-primary/80"
 >
 Show Neon SQL Script Preview
 </Button>
 )}
 </>
 ) : (
 <>
 <div className="space-y-3">
 <p className="text-sm text-foreground">
 <strong>Step 1:</strong> Go to your Supabase dashboard → SQL Editor
 </p>
 <p className="text-sm text-foreground">
 <strong>Step 2:</strong> Copy the complete SQL setup script below
 </p>
 <p className="text-sm text-foreground">
 <strong>Step 3:</strong> Paste and run the script in your SQL Editor
 </p>
 <p className="text-sm text-foreground">
 <strong>Step 4:</strong> Return here, test your connection, then <strong>refresh the app</strong>
 </p>
 </div>

 <Alert className="border-primary/50 bg-primary/10">
 <AlertCircle className="h-4 w-4 text-primary" />
 <AlertDescription className="text-foreground">
 <strong>Important:</strong> After successful connection, click"Refresh App" to load your dashboard properly, especially when using the PWA version.
 </AlertDescription>
 </Alert>

 <Alert className="border-amber-500 bg-amber-950/20">
 <AlertCircle className="h-4 w-4 text-amber-400" />
 <AlertDescription className="text-amber-200">
 Existing databases must run the update script below before `document` and `misc` credentials will work.
 </AlertDescription>
 </Alert>

 <div className="flex gap-3 flex-wrap">
 <Button
 variant="outline"
 onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
 className="flex items-center gap-2"
 >
 <ExternalLink className="h-4 w-4" />
 Open Supabase Dashboard
 </Button>

 <Button
 onClick={() => copyToClipboard(sqlScript, 'Complete SQL setup script')}
 className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
 >
 <Copy className="h-4 w-4" />
 Copy Complete SQL Script
 </Button>

 <Button
 onClick={() => copyToClipboard(updateSqlScript, 'Existing database update SQL script')}
 className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
 >
 <Copy className="h-4 w-4" />
 Copy Update Script
 </Button>
 </div>

 {showSqlScript && (
 <div className="mt-4">
 <Label className="text-sm font-medium mb-2 block">SQL Script Preview:</Label>
 <div className="bg-card p-4 rounded-lg max-h-40 overflow-y-auto">
 <pre className="text-xs text-foreground whitespace-pre-wrap">
 {sqlScript.substring(0, 500)}...
 </pre>
 </div>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => setShowSqlScript(false)}
 className="mt-2"
 >
 Hide Preview
 </Button>
 </div>
 )}

 {!showSqlScript && (
 <Button
 variant="ghost"
 size="sm"
 onClick={() => setShowSqlScript(true)}
 className="text-primary hover:text-primary/80"
 >
 Show SQL Script Preview
 </Button>
 )}

 {showUpdateSqlScript && (
 <div className="mt-4">
 <Label className="text-sm font-medium mb-2 block">Update Script Preview:</Label>
 <div className="bg-card p-4 rounded-lg max-h-40 overflow-y-auto">
 <pre className="text-xs text-foreground whitespace-pre-wrap">
 {updateSqlScript}
 </pre>
 </div>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => setShowUpdateSqlScript(false)}
 className="mt-2"
 >
 Hide Update Preview
 </Button>
 </div>
 )}

 {!showUpdateSqlScript && (
 <Button
 variant="ghost"
 size="sm"
 onClick={() => setShowUpdateSqlScript(true)}
 className="text-green-400 hover:text-green-300"
 >
 Show Update Script Preview
 </Button>
 )}
 </>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="about" className="space-y-6">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 🔐 Keyper - Self-Hosted
 </CardTitle>
 <CardDescription>
 Secure credential management for your own infrastructure
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label className="text-sm font-medium">Version</Label>
 <p className="text-sm text-foreground">0.1.0</p>
 </div>
 <div>
 <Label className="text-sm font-medium">Mode</Label>
 <Badge variant="secondary">Self-Hosted</Badge>
 </div>
 </div>

 <Separator />

 <div className="space-y-2">
 <Label className="text-sm font-medium">Made with ❤️ by Pink Pixel</Label>
 <p className="text-sm text-muted-foreground">Dream it, Pixel it ✨</p>
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="security" className="space-y-6">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Shield className="h-5 w-5 text-green-500" />
 Security Information
 </CardTitle>
 <CardDescription>
 Keyper's security architecture and encryption details
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-6">
 <div className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="p-4 bg-muted/50 rounded-lg">
 <div className="space-y-1">
 <Label className="text-sm font-medium">Encryption Method</Label>
 <p className="text-sm text-muted-foreground">AES-GCM with Argon2id key derivation</p>
 </div>
 </div>
 <div className="p-4 bg-muted/50 rounded-lg">
 <div className="space-y-1">
 <Label className="text-sm font-medium">Storage</Label>
 <p className="text-sm text-muted-foreground">Database-only encrypted storage</p>
 </div>
 </div>
 <div className="p-4 bg-muted/50 rounded-lg">
 <div className="space-y-1">
 <Label className="text-sm font-medium">Zero Knowledge</Label>
 <p className="text-sm text-muted-foreground">Passphrase never leaves your device</p>
 </div>
 </div>
 <div className="p-4 bg-muted/50 rounded-lg">
 <div className="space-y-1">
 <Label className="text-sm font-medium">Auto-Lock</Label>
 <p className="text-sm text-muted-foreground">15-minute inactivity timeout</p>
 </div>
 </div>
 </div>

 <Alert>
 <Shield className="h-4 w-4" />
 <AlertDescription>
 <strong>Security Note:</strong> Keyper uses client-side encryption with database-only storage.
 Your master passphrase is never transmitted or stored - it only exists in memory while you're using the app.
 </AlertDescription>
 </Alert>

 <div className="space-y-2">
 <Label className="text-sm font-medium">Security Features</Label>
 <ul className="text-sm text-muted-foreground space-y-1">
 <li>• End-to-end encryption with AES-GCM</li>
 <li>• Argon2id key derivation (memory-hard)</li>
 <li>• Auto-lock on inactivity</li>
 <li>• Database breach protection</li>
 <li>• Zero-knowledge architecture</li>
 <li>• No localStorage storage of sensitive data</li>
 </ul>
 </div>
 </div>
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>
 </div>
 );
};
