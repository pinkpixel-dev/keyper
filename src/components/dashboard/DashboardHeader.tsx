
import React from 'react';
import { User} from '@supabase/supabase-js';
import { Button} from '@/components/ui/button';
import { Plus, Shield, RefreshCw, BookOpen, Settings as SettingsIcon} from 'lucide-react';

interface DashboardHeaderProps {
 user: User;
 onAddCredential: () => void;
 onRefresh: () => void;
 onOpenSettings: () => void;
}

export const DashboardHeader = ({ user, onAddCredential, onRefresh, onOpenSettings}: DashboardHeaderProps) => {

 // The header's top padding clears a phone's camera cutout when the app runs
 // installed and draws behind the status bar. env() resolves to 0 on hardware
 // without an inset, so this costs nothing elsewhere. It needs viewport-fit=cover
 // on the viewport meta tag to report a real value.
 return (
 <header className="bg-background/80 backdrop-blur-sm border-b border-border pt-[env(safe-area-inset-top)]">
 <div className="w-full max-w-[2000px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
 <div className="flex items-center justify-between h-16">
 <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
 <div className="p-1 bg-primary/15 rounded-lg border border-primary/30 shrink-0">
 <img
 src="/logo.png"
 alt="Keyper Logo"
 className="h-8 w-8 sm:h-11 sm:w-11 rounded-full object-contain"
 />
 </div>
 <div className="min-w-0">
 <h1 className="text-lg sm:text-2xl font-bold text-foreground font-sans truncate">Keyper</h1>
 <p className="hidden sm:block text-sm text-muted-foreground truncate">Secure credential vault</p>
 </div>
 </div>

 <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-4 shrink-0">
 <div className="hidden lg:flex items-center space-x-2 text-sm text-foreground">
 <Shield className="h-4 w-4 text-primary" />
 <span>Self-Hosted Keyper</span>
 </div>

 <Button
 onClick={onRefresh}
 variant="outline"
 size="sm"
 className="flex items-center gap-2"
 >
 <RefreshCw className="h-4 w-4" />
 <span className="hidden md:inline">Refresh</span>
 </Button>

 <Button asChild variant="outline" size="sm" className="flex items-center gap-2">
 <a
 href="https://keyper.icu"
 target="_blank"
 rel="noopener noreferrer"
 aria-label="Open Keyper documentation website"
 >
 <BookOpen className="h-4 w-4" />
 <span className="hidden md:inline">Docs</span>
 </a>
 </Button>

 <Button
 onClick={onAddCredential}
 className="bg-primary text-primary-foreground hover:bg-primary/90"
 size="sm"
 /* The visible label shortens to "Add" on phones, so name the button
 explicitly. Without this its accessible name changes with the
 viewport. "Add Credential" still contains the visible "Add", which
 is what WCAG 2.5.3 asks for. */
 aria-label="Add Credential"
 >
 <Plus className="h-4 w-4 mr-1 sm:mr-2" />
 <span className="sm:hidden">Add</span>
 <span className="hidden sm:inline">Add Credential</span>
 </Button>

 {/* Settings belongs in this row rather than floating over it. It used to
 be absolutely positioned in the same corner, which put it on top of
 Add Credential at every width below 2200px. */}
 <Button
 onClick={onOpenSettings}
 variant="outline"
 size="sm"
 className="flex items-center gap-2"
 aria-label="Settings"
 >
 <SettingsIcon className="h-4 w-4" />
 <span className="hidden md:inline">Settings</span>
 </Button>
 </div>
 </div>
 </div>
 </header>
 );
};
