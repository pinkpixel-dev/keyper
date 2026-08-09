import React, { useState, useEffect, Suspense} from 'react';
import type { User} from '@supabase/supabase-js';
import { getSupabaseCredentials, hasConfiguredDatabase, getCurrentUsername, supabase, refreshSupabaseClient} from '@/integrations/supabase/client';
import { getOwnerId, ownerColumn, getCurrentUser} from '@/integrations/supabase/auth';
import { Button} from '@/components/ui/button';
import { Settings as SettingsIcon, ArrowLeft, Plus, Shield, RefreshCw, Database, Lock} from 'lucide-react';
import { useToast} from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import PassphraseGate from '@/components/PassphraseGate';
import AuthGate from '@/components/auth/AuthGate';
import type { SecretBlobV1} from '@/crypto/types';

// Lazy load heavy components
const Settings = React.lazy(() => import('@/components/Settings').then(module => ({ default: module.Settings})));
const DashboardHeader = React.lazy(() => import('./dashboard/DashboardHeader').then(module => ({ default: module.DashboardHeader})));
const SearchAndFilters = React.lazy(() => import('./dashboard/SearchAndFilters').then(module => ({ default: module.SearchAndFilters})));
const CredentialsGrid = React.lazy(() => import('./dashboard/CredentialsGrid').then(module => ({ default: module.CredentialsGrid})));
const AddCredentialModal = React.lazy(() => import('./dashboard/AddCredentialModal').then(module => ({ default: module.AddCredentialModal})));
const CredentialDetailModal = React.lazy(() => import('./dashboard/CredentialDetailModal').then(module => ({ default: module.CredentialDetailModal})));
const DashboardSettings = React.lazy(() => import('./dashboard/DashboardSettings').then(module => ({ default: module.DashboardSettings})));

// Interfaces for credential management
export interface Credential {
 id: string;
 title: string;
 description?: string;
 credential_type: 'api_key' | 'login' | 'secret' | 'token' | 'certificate' | 'document' | 'misc';
 priority: 'low' | 'medium' | 'high' | 'critical';
 username?: string;
 password?: string;
 api_key?: string;
 secret_value?: string;
 token_value?: string;
 certificate_data?: string;
 misc_value?: string;
 document_name?: string;
 document_mime_type?: string;
 document_content_base64?: string;
 document_size_bytes?: number;
 url?: string;
 tags: string[];
 category?: string;
 notes?: string;
 created_at: string;
 updated_at: string;
 last_accessed?: string;
 expires_at?: string;
 // Encryption fields
 secret_blob?: SecretBlobV1 | null;
 encrypted_at?: string | null;
}

export interface Category {
 id: string;
 name: string;
 color: string;
 icon?: string;
}

// Placeholder user for the local providers (SQLite, Neon), which have no
// session to read. On Supabase the real session user is used instead; this only
// ever feeds the header display.
const createLocalUser = (): User => {
 const currentUsername = getCurrentUsername();
 return {
 id: currentUsername,
 email: `${currentUsername}@localhost`,
 user_metadata: {},
 app_metadata: {},
 aud: 'authenticated',
 created_at: new Date().toISOString(),
 updated_at: new Date().toISOString(),
 email_confirmed_at: new Date().toISOString(),
 last_sign_in_at: new Date().toISOString(),
 role: 'authenticated',
 confirmation_sent_at: null,
 confirmed_at: new Date().toISOString(),
 recovery_sent_at: null,
 email_change_sent_at: null,
 new_email: null,
 invited_at: null,
 action_link: null,
 phone: null,
 phone_confirmed_at: null,
 phone_change_sent_at: null,
 new_phone: null,
 factors: null,
 identities: []
} as User;
};

export const SelfHostedDashboard: React.FC = () => {
 const [showSettings, setShowSettings] = useState(false);
 const [showDashboardSettings, setShowDashboardSettings] = useState(false);
 const [isConfigured, setIsConfigured] = useState(false);

 // Credential management state
 const [credentials, setCredentials] = useState<Credential[]>([]);
 const [categories, setCategories] = useState<Category[]>([]);
 const [sessionUser, setSessionUser] = useState<User | null>(null);
 const [loading, setLoading] = useState(true);
 const [searchTerm, setSearchTerm] = useState('');
 const [selectedCategory, setSelectedCategory] = useState<string>('all');
 const [selectedType, setSelectedType] = useState<string>('all');
 const [selectedTags, setSelectedTags] = useState<string[]>([]);
 const [isAddModalOpen, setIsAddModalOpen] = useState(false);
 const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);
 const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('keyper-view-mode') as 'grid' | 'list') || 'grid';
  });
 const { toast} = useToast();

 const handleSetViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('keyper-view-mode', mode);
  };

 // Check if a database provider is configured on component mount
 useEffect(() => {
 const hasConfiguredStorage = hasConfiguredDatabase();
 setIsConfigured(hasConfiguredStorage);

 // Always try to fetch data if configured
 if (hasConfiguredStorage) {
 void getCurrentUser().then(setSessionUser);
 fetchCredentials();
 fetchCategories();
} else {
 // If not configured, just stop loading so dashboard shows
 setLoading(false);
}
 // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

 // Credential management functions
 const handleRefresh = () => {
 setLoading(true);
 fetchCredentials();
 fetchCategories();
 toast({
 title:"Refreshed! 🔄",
 description:"Credentials and categories have been updated.",
});
};

 const fetchCredentials = async () => {
 try {
 // This component's effects run before AuthGate decides what to render, so
 // a signed-out visit would otherwise fire a doomed query and pop an error
 // toast over the sign-in form. No session simply means nothing to fetch.
 const ownerId = await getOwnerId();
 if (!ownerId) {
 setCredentials([]);
 return;
}

 const { data, error} = await supabase
 .from('credentials')
 .select('*')
 .eq(ownerColumn(), ownerId)
 .order('updated_at', { ascending: false});

 if (error) throw error;
 setCredentials((data || []) as Credential[]);
} catch (error: unknown) {
 toast({
 title:"Error",
 description:"Failed to fetch credentials",
 variant:"destructive",
});
} finally {
 setLoading(false);
}
};

 const fetchCategories = async () => {
 try {
 // Every account gets its own default categories when its vault is created,
 // so there is no shared pool to merge in and nothing to de-duplicate. The
 // query is scoped to the owner and that is the whole story.
 const ownerId = await getOwnerId();
 if (!ownerId) {
 setCategories([]);
 return;
}

 const { data, error} = await supabase
 .from('categories')
 .select('*')
 .eq(ownerColumn(), ownerId)
 .order('name');

 if (error) throw error;

 setCategories((data || []) as Category[]);
} catch (error: unknown) {
 console.error('Error fetching categories:', error);
}
};

 const handleConfigurationComplete = () => {
 setIsConfigured(true);
 setShowSettings(false);
 // Refresh the Supabase client with new credentials
 refreshSupabaseClient();
 // Fetch data after configuration
 fetchCredentials();
 fetchCategories();
};

 const handleShowDatabaseSettings = () => {
 setShowSettings(true);
};

 const handleShowDashboardSettings = () => {
 setShowDashboardSettings(true);
};

 const handleBackToDashboard = () => {
 setShowSettings(false);
 setShowDashboardSettings(false);
};

 // Filtering logic
 const filteredCredentials = credentials.filter(credential => {
 const matchesSearch = credential.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
 credential.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
 credential.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
 credential.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

 const matchesCategory = selectedCategory === 'all' || credential.category === selectedCategory;
 const matchesType = selectedType === 'all' || credential.credential_type === selectedType;
 const matchesTags = selectedTags.length === 0 ||
 selectedTags.some(tag => credential.tags.includes(tag));

 return matchesSearch && matchesCategory && matchesType && matchesTags;
});

 const allTags = [...new Set(credentials.flatMap(c => c.tags))];

 // Step 1: Show dashboard settings if user requests it from dashboard
 if (showDashboardSettings) {
 return (
 <div className="min-h-screen bg-dot-pattern text-foreground">
 <div className="container mx-auto py-8">
 <div className="mb-6">
 <Button
 variant="outline"
 onClick={handleBackToDashboard}
 className="flex items-center gap-2"
 >
 <ArrowLeft className="h-4 w-4" />
 Back to Dashboard
 </Button>
 </div>
 <Suspense fallback={<div className="flex items-center justify-center p-8">Loading settings...</div>}>
 <DashboardSettings onUserContextChanged={() => {}} />
 </Suspense>
 </div>
 </div>
 );
}

 // Step 1b: Show database settings if configuring for first time
 if (showSettings) {
 return (
 <div className="min-h-screen bg-dot-pattern text-foreground">
 <div className="container mx-auto py-8">
 <div className="mb-6">
 <Button
 variant="outline"
 onClick={handleBackToDashboard}
 className="flex items-center gap-2"
 >
 <ArrowLeft className="h-4 w-4" />
 Back to Dashboard
 </Button>
 </div>
 <Suspense fallback={<div className="flex items-center justify-center p-8">Loading configuration...</div>}>
 <Settings onConfigurationComplete={handleConfigurationComplete} />
 </Suspense>
 </div>
 </div>
 );
}

 // Step 2: Show database configuration screen if not configured
 if (!isConfigured) {
 return (
 <div className="min-h-screen bg-dot-pattern text-foreground flex items-center justify-center p-4">
 <Card className="w-full max-w-2xl">
 <CardHeader className="text-center">
 {/* Keyper Logo and Title */}
 <div className="flex items-center justify-center gap-3 mb-4">
 <div className="p-1 bg-primary/15 rounded-lg border border-primary/30">
 <img
 src="/logo.png"
 alt="Keyper Logo"
 className="h-8 w-8 rounded-full object-contain"
 />
 </div>
 <h1 className="text-xl font-bold text-foreground font-sans">Keyper</h1>
 </div>

 <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
 <Database className="h-8 w-8 text-primary" />
 </div>
 <CardTitle className="text-2xl">
 Database Configuration Required
 </CardTitle>
 <CardDescription>
 Choose a database provider and configure how Keyper should store your encrypted credentials.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-3">
 <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
 <div className="shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">1</div>
 <div>
 <h4 className="font-medium">Choose your database provider</h4>
 <p className="text-sm text-muted-foreground">Use SQLite for local-first storage, Supabase for hosted storage, or Neon for cloud/local Postgres.</p>
 </div>
 </div>
 <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
 <div className="shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">2</div>
 <div>
 <h4 className="font-medium">Configure connection</h4>
 <p className="text-sm text-muted-foreground">SQLite is created by Keyper. Supabase and Neon require connection details plus the matching setup script.</p>
 </div>
 </div>
 <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
 <div className="shrink-0 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
 <div>
 <h4 className="font-medium">Secure vault setup</h4>
 <p className="text-sm text-muted-foreground">Create your master passphrase to encrypt and protect your credentials</p>
 </div>
 </div>
 </div>

 <div className="pt-4">
 <Button
 onClick={handleShowDatabaseSettings}
 className="w-full"
 size="lg"
 >
 <Database className="h-4 w-4 mr-2" />
 Configure Database
 </Button>
 </div>
 </CardContent>
 </Card>
 </div>
 );
}

 // Handle database connection errors from PassphraseGate
 const handleDatabaseError = () => {
 // Reset configuration and show settings
 setIsConfigured(false);
 setShowSettings(true);
 toast({
 title:"Database Error",
 description:"Please check your database configuration and setup.",
 variant:"destructive",
});
};

 // Step 3: Require a session, then the master passphrase, then the dashboard.
 // Two gates because they protect different things: AuthGate decides whether
 // the database returns your rows, PassphraseGate decides whether they decrypt.
 return (
 <AuthGate>
 <PassphraseGate
 autoLockMs={15 * 60 * 1000} // 15 minutes
 showMetrics={false}
 onUnlock={async () => {
 // Refresh credentials when vault is unlocked
 fetchCredentials();
}}
 onDatabaseError={handleDatabaseError}
 >
 <div className="min-h-screen bg-dot-pattern text-foreground">
 {/* Settings Button in Header */}
 <div className="absolute top-4 right-4 z-10">
 <Button
 variant="outline"
 size="sm"
 onClick={handleShowDashboardSettings}
 className="flex items-center gap-2"
 >
 <SettingsIcon className="h-4 w-4" />
 Settings
 </Button>
 </div>

 {/* Main Dashboard */}
 <div className="min-h-screen bg-dot-pattern text-foreground">
 <Suspense fallback={<div className="h-20 bg-card/50 animate-pulse" />}>
 <DashboardHeader
 user={sessionUser ?? createLocalUser()}
 onAddCredential={() => setIsAddModalOpen(true)}
 onRefresh={handleRefresh}
 />
 </Suspense>

 <div className="w-full max-w-[2000px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-8">
 <Suspense fallback={<div className="h-16 bg-muted/50 rounded-lg animate-pulse mb-6" />}>
  <SearchAndFilters
  searchTerm={searchTerm}
  setSearchTerm={setSearchTerm}
  selectedCategory={selectedCategory}
  setSelectedCategory={setSelectedCategory}
  selectedType={selectedType}
  setSelectedType={setSelectedType}
  selectedTags={selectedTags}
  setSelectedTags={setSelectedTags}
  categories={categories}
  allTags={allTags}
  viewMode={viewMode}
  onViewModeChange={handleSetViewMode}
  />
  </Suspense>

  <Suspense fallback={
    viewMode === 'list' ? (
      <div className="space-y-3">
        <div className="h-16 bg-muted/50 rounded-lg animate-pulse"></div>
        <div className="h-16 bg-muted/50 rounded-lg animate-pulse"></div>
        <div className="h-16 bg-muted/50 rounded-lg animate-pulse"></div>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="h-48 bg-muted/50 rounded-lg animate-pulse"></div>
        <div className="h-48 bg-muted/50 rounded-lg animate-pulse"></div>
        <div className="h-48 bg-muted/50 rounded-lg animate-pulse"></div>
      </div>
    )
  }>
  <CredentialsGrid
  credentials={filteredCredentials}
  loading={loading}
  onCredentialClick={setSelectedCredential}
  viewMode={viewMode}
  />
  </Suspense>
 </div>

 <Suspense fallback={null}>
 <AddCredentialModal
 isOpen={isAddModalOpen}
 onClose={() => setIsAddModalOpen(false)}
 categories={categories}
 onCredentialAdded={fetchCredentials}
 />
 </Suspense>

 {selectedCredential && (
 <Suspense fallback={null}>
 <CredentialDetailModal
 credential={selectedCredential}
 onClose={() => setSelectedCredential(null)}
 categories={categories}
 onCredentialUpdated={fetchCredentials}
 />
 </Suspense>
 )}
 </div>
 </div>
 </PassphraseGate>
 </AuthGate>
 );
};
