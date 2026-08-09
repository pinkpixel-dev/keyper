/**
 * PassphraseGate - Vault unlock UI component
 *
 * Provides a secure interface for unlocking the encrypted vault.
 * Features auto-lock timer, passphrase strength validation, and elegant UI.
 *
 * Made with ❤️ by Pink Pixel ✨
 */

import React, { useState, useEffect, useCallback} from 'react';
import { vaultManager} from '@/services/VaultManager';
import { Button} from '@/components/ui/button';
import { Input} from '@/components/ui/input';
import { Label} from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import { Progress} from '@/components/ui/progress';
import { Badge} from '@/components/ui/badge';
import { Alert, AlertDescription} from '@/components/ui/alert';
import { getDisplayName} from '@/integrations/supabase/auth';
import {
 Lock,
 Unlock,
 Eye,
 EyeOff,
 Shield,
 Timer,
 AlertTriangle,
 CheckCircle,
 Info,
 Settings,
 UserPlus
} from 'lucide-react';
import { useToast} from '@/hooks/use-toast';
import { analyzePassphrase, getStrengthColor} from '@/security/PassphraseValidator';
import type { PassphraseAnalysis} from '@/security/PassphraseValidator';
import type { VaultEvent} from '@/services/SecureVault';

interface PassphraseGateProps {
 children: React.ReactNode;
 onUnlock?: () => void;
 onLock?: () => void;
 onDatabaseError?: () => void;
 autoLockMs?: number;
 showMetrics?: boolean;
 className?: string;
}

export default function PassphraseGate({
 children,
 onUnlock,
 onLock,
 onDatabaseError,
 autoLockMs = 15 * 60 * 1000, // 15 minutes default
 showMetrics = false,
 className =""
}: PassphraseGateProps) {
 const [isUnlocked, setIsUnlocked] = useState(vaultManager.isUnlocked());
 const [accountName, setAccountName] = useState('');
 const [passphrase, setPassphrase] = useState('');
 const [showPassphrase, setShowPassphrase] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [isUnlocking, setIsUnlocking] = useState(false);
 const [timeUntilLock, setTimeUntilLock] = useState(0);
 const [passphraseAnalysis, setPassphraseAnalysis] = useState<PassphraseAnalysis | null>(null);
 const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);
 const [showSetup, setShowSetup] = useState(false);

 const { toast} = useToast();

 // Handle vault events
 const handleVaultEvent = useCallback((event: VaultEvent) => {
 switch (event) {
 case 'unlocked':
 setIsUnlocked(true);
 setPassphrase('');
 setError(null);
 onUnlock?.();
 toast({
 title:"🔓 Vault Unlocked",
 description:"Your credentials are now accessible",
});
 break;
 case 'locked':
 setIsUnlocked(false);
 setPassphrase('');
 onLock?.();
 toast({
 title:"🔒 Vault Locked",
 description:"Your credentials are now secure",
});
 break;
 case 'auto-locked':
 setIsUnlocked(false);
 setPassphrase('');
 onLock?.();
 toast({
 title:"⏰ Auto-Lock Activated",
 description:"Vault locked due to inactivity",
 variant:"default"
});
 break;
}
}, [onUnlock, onLock, toast]);

// Show who is signed in, so it is obvious which vault is about to open.
useEffect(() => {
 void getDisplayName().then(setAccountName);
}, []);

 // Does this account already have a vault?
 useEffect(() => {
 const checkFirstTimeUser = async () => {
 try {
 setIsFirstTime(await vaultManager.isFirstTimeUser());
} catch (error: unknown) {
 console.error('Error checking first-time user status:', error);
 // Deliberately leave isFirstTime null rather than defaulting to true.
 // Guessing "new user" when the vault merely failed to load would offer
 // to create a fresh vault over one that already exists.
 setIsFirstTime(null);
 setError('Could not reach your vault. Check your database configuration and try again.');
}
};

 void checkFirstTimeUser();
}, []);

 // Setup vault event listener and auto-lock
 useEffect(() => {
 vaultManager.addEventListener(handleVaultEvent);
 vaultManager.setAutoLockTimeout(autoLockMs);

 return () => {
 vaultManager.removeEventListener(handleVaultEvent);
};
}, [handleVaultEvent, autoLockMs]);

 // Update countdown timer
 useEffect(() => {
 if (!isUnlocked) return;

 const interval = setInterval(() => {
 const remaining = vaultManager.getTimeUntilAutoLock();
 setTimeUntilLock(remaining);
}, 1000);

 return () => clearInterval(interval);
}, [isUnlocked]);

 // Update passphrase analysis
 useEffect(() => {
 if (passphrase) {
 const analysis = analyzePassphrase(passphrase);
 setPassphraseAnalysis(analysis);
} else {
 setPassphraseAnalysis(null);
}
}, [passphrase]);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();

 const trimmedPassphrase = passphrase.trim();
 if (!trimmedPassphrase || trimmedPassphrase.length < 8) {
 setError("Passphrase must be at least 8 characters long");
 return;
}

 setIsUnlocking(true);
 setError(null);

 try {
 // Identity comes from the signed-in session now, not a typed-in username.
 const firstTime = await vaultManager.isFirstTimeUser();

 if (firstTime) {
 console.log('🆕 Creating new vault...');
 await vaultManager.createVault(trimmedPassphrase);
} else {
 console.log('🔓 Unlocking existing vault...');
 await vaultManager.unlockVault(trimmedPassphrase);
}
 // Vault event handler will update UI state
} catch (error) {
 console.error('💥 Vault operation failed:', error);
 setError(error instanceof Error ? error.message :"Failed to unlock vault");
} finally {
 setIsUnlocking(false);
}
};

 const handleLock = () => {
 vaultManager.lockVault();
};

 const formatTime = (ms: number): string => {
 const minutes = Math.floor(ms / 60000);
 const seconds = Math.floor((ms % 60000) / 1000);
 return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

 const getStrengthLabel = (strength: string): string => {
 const labels = {
 'very-weak': 'Very Weak',
 'weak': 'Weak',
 'fair': 'Fair',
 'good': 'Good',
 'strong': 'Strong',
 'very-strong': 'Very Strong'
};
 return labels[strength as keyof typeof labels] || 'Unknown';
};

 // If unlocked, show children with optional lock controls
 if (isUnlocked) {
 return (
 <div className={className}>
 {/* Auto-lock status bar */}
 {autoLockMs > 0 && (
 <div className="fixed top-20 right-4 z-40">
 <Card className="w-64 bg-background/95 backdrop-blur-sm border-border/50">
 <CardContent className="p-3">
 <div className="flex items-center justify-between text-sm">
 <div className="flex items-center gap-2">
 <Shield className="h-4 w-4 text-green-500" />
 <span className="text-muted-foreground">Vault Unlocked</span>
 </div>
 <Button
 variant="ghost"
 size="sm"
 onClick={handleLock}
 className="h-6 px-2 text-xs"
 >
 <Lock className="h-3 w-3 mr-1" />
 Lock
 </Button>
 </div>
 {timeUntilLock > 0 && (
 <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
 <Timer className="h-3 w-3" />
 <span>Auto-lock: {formatTime(timeUntilLock)}</span>
 </div>
 )}
 </CardContent>
 </Card>
 </div>
 )}

 {children}
 </div>
 );
}

 // Show unlock interface
 return (
 <>
 <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-40 p-4">
 <Card className="w-full max-w-md">
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
 <h1 className="text-xl font-bold text-foreground">Keyper</h1>
 </div>

 <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
 <Lock className="h-8 w-8 text-primary" />
 </div>
 <CardTitle className="text-2xl">
 {isFirstTime ? 'Create Master Passphrase' : 'Enter Master Passphrase'}
 </CardTitle>
 <CardDescription>
 {isFirstTime
 ? 'Create a strong passphrase to secure your credential vault'
 : 'Enter your passphrase to unlock your secure credential vault'
}
 </CardDescription>
 {accountName && (
 <p className="text-xs text-muted-foreground pt-1">
 Signed in as <span className="font-medium text-foreground">{accountName}</span>
 </p>
 )}
 </CardHeader>

 <CardContent className="space-y-4">
 <form onSubmit={handleSubmit} className="space-y-4">
 <div className="space-y-4">
 {/* Passphrase field */}
 <div className="space-y-2">
 <Label htmlFor="passphrase">Master Passphrase</Label>
 <div className="relative">
 <Input
 id="passphrase"
 type={showPassphrase ?"text" :"password"}
 placeholder="Enter your passphrase"
 value={passphrase}
 onChange={(e) => setPassphrase(e.target.value)}
 className="pr-10"
 disabled={isUnlocking}
 />
 <Button
 type="button"
 variant="ghost"
 size="sm"
 className="absolute right-0 top-0 h-full px-3"
 onClick={() => setShowPassphrase(!showPassphrase)}
 >
 {showPassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
 </Button>
 </div>

 {/* Passphrase strength indicator */}
 {passphrase && passphraseAnalysis && (
 <div className="space-y-2">
 <div className="flex items-center justify-between text-sm">
 <span className="text-muted-foreground">Strength:</span>
 <Badge
 variant="outline"
 className="text-foreground"
 style={{ backgroundColor: getStrengthColor(passphraseAnalysis.strength)}}
 >
 {getStrengthLabel(passphraseAnalysis.strength)}
 </Badge>
 </div>
 <Progress value={passphraseAnalysis.score} className="h-2" />
 {passphraseAnalysis.warnings.length > 0 && (
 <div className="text-xs text-red-500">
 {passphraseAnalysis.warnings.slice(0, 2).join(",")}
 </div>
 )}
 {passphraseAnalysis.recommendations.length > 0 && passphraseAnalysis.warnings.length === 0 && (
 <div className="text-xs text-muted-foreground">
 {passphraseAnalysis.recommendations.slice(0, 1).join(",")}
 </div>
 )}
 </div>
 )}
 </div>
 </div>

 {error && (
 <Alert variant="destructive">
 <AlertTriangle className="h-4 w-4" />
 <AlertDescription>{error}</AlertDescription>
 {error.includes('Database connection failed') && onDatabaseError && (
 <div className="mt-3">
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={onDatabaseError}
 className="w-full"
 >
 <Settings className="h-4 w-4 mr-2" />
 Configure Database
 </Button>
 </div>
 )}
 </Alert>
 )}

 <Button
 type="submit"
 className="w-full"
 disabled={isUnlocking || !passphrase}
 >
 {isUnlocking ? (
 <>
 <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
 Unlocking...
 </>
 ) : (
 <>
 <Unlock className="h-4 w-4 mr-2" />
 Unlock Vault
 </>
 )}
 </Button>
 </form>

 <Alert>
 <Info className="h-4 w-4" />
 <AlertDescription className="text-sm">
 This passphrase is what encrypts your credentials, and it is never sent anywhere.
 Nobody can reset it for you, so if you lose it the vault cannot be recovered.
 </AlertDescription>
 </Alert>

 {showMetrics && (
 <div className="pt-4 border-t">
 <div className="text-xs text-muted-foreground text-center">
 🔐 End-to-end encrypted • 🔑 Key never leaves this device
 </div>
 </div>
 )}
 </CardContent>
 </Card>
 </div>
 </>
 );
}
