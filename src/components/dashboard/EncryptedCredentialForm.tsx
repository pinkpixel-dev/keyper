/**
 * EncryptedCredentialForm - Enhanced credential form with encryption support
 * 
 * Provides a form interface for creating and editing credentials with
 * automatic encryption of sensitive fields using the vault system.
 * 
 * Made with ❤️ by Pink Pixel ✨
 */

import React, { useState, useEffect} from 'react';
import { Button} from '@/components/ui/button';
import { Input} from '@/components/ui/input';
import { Label} from '@/components/ui/label';
import { Textarea} from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import { Badge} from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import { Alert, AlertDescription} from '@/components/ui/alert';
import { Switch} from '@/components/ui/switch';
import { useToast} from '@/hooks/use-toast';
import { useEncryption} from '@/hooks/useVault';
import { supabase} from '@/integrations/supabase/client';
import { ownershipFields} from '@/integrations/supabase/auth';
import { 
 Shield, 
 ShieldCheck, 
 AlertTriangle, 
 Plus, 
 X, 
 Lock,
 Unlock,
 Info
} from 'lucide-react';
import type { Category} from '../SelfHostedDashboard';
import type { SecretBlobV1} from '@/crypto/types';

interface EncryptedCredentialFormProps {
 /** Existing credential data for editing (optional) */
 initialData?: {
 id?: string;
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
 category?: string;
 notes?: string;
 expires_at?: string;
 tags?: string[];
 secret_blob?: SecretBlobV1 | null;
 encrypted_at?: string | null;
};
 /** Available categories */
 categories: Category[];
 /** Callback when credential is saved */
 onSave: () => void;
 /** Callback when form is cancelled */
 onCancel: () => void;
 /** Whether this is an edit operation */
 isEditing?: boolean;
}

type CredentialType = 'api_key' | 'login' | 'secret' | 'token' | 'certificate' | 'document' | 'misc';
type Priority = 'low' | 'medium' | 'high' | 'critical';

export default function EncryptedCredentialForm({
 initialData,
 categories,
 onSave,
 onCancel,
 isEditing = false
}: EncryptedCredentialFormProps) {
 const [formData, setFormData] = useState({
 title: initialData?.title || '',
 description: initialData?.description || '',
 credential_type: (initialData?.credential_type || 'api_key') as CredentialType,
 priority: (initialData?.priority || 'medium') as Priority,
 username: initialData?.username || '',
 password: initialData?.password || '',
 api_key: initialData?.api_key || '',
 secret_value: initialData?.secret_value || '',
 token_value: initialData?.token_value || '',
 certificate_data: initialData?.certificate_data || '',
 misc_value: initialData?.misc_value || '',
 document_name: initialData?.document_name || '',
 document_mime_type: initialData?.document_mime_type || '',
 document_content_base64: initialData?.document_content_base64 || '',
 document_size_bytes: initialData?.document_size_bytes || 0,
 url: initialData?.url || '',
 category: initialData?.category || '',
 notes: initialData?.notes || '',
 expires_at: initialData?.expires_at || '',
});
 
 const [tags, setTags] = useState<string[]>(initialData?.tags || []);
 const [tagInput, setTagInput] = useState('');
 const [loading, setLoading] = useState(false);
 const [enableEncryption, setEnableEncryption] = useState(true);
 const [showEncryptionWarning, setShowEncryptionWarning] = useState(false);

 const { toast} = useToast();
 const vault = useEncryption();

 const credentialTypes = [
 { value: 'api_key', label: 'API Key'},
 { value: 'login', label: 'Login'},
 { value: 'secret', label: 'Secret'},
 { value: 'token', label: 'Token'},
 { value: 'certificate', label: 'Certificate'},
 { value: 'document', label: 'Document'},
 { value: 'misc', label: 'Miscellaneous'},
 ] as const;

 const priorities = [
 { value: 'low', label: 'Low'},
 { value: 'medium', label: 'Medium'},
 { value: 'high', label: 'High'},
 { value: 'critical', label: 'Critical'},
 ] as const;

 // Check if vault is unlocked when encryption is enabled
 useEffect(() => {
 if (enableEncryption && !vault.isUnlocked) {
 setShowEncryptionWarning(true);
} else {
 setShowEncryptionWarning(false);
}
}, [enableEncryption, vault.isUnlocked]);

 // Determine if we have sensitive data that should be encrypted
 const hasSensitiveData = () => {
 return !!(
 formData.password ||
 formData.api_key ||
 formData.secret_value ||
 formData.token_value ||
 formData.certificate_data ||
 formData.misc_value ||
 formData.document_content_base64
 );
};

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 
 if (!formData.title.trim()) {
 toast({
 title:"❌ Validation Error",
 description:"Title is required",
 variant:"destructive",
});
 return;
}

 // Check if encryption is needed but vault is locked
 if (enableEncryption && hasSensitiveData() && !vault.isUnlocked) {
 toast({
 title:"🔒 Vault Locked",
 description:"Unlock the vault to encrypt sensitive data",
 variant:"destructive",
});
 return;
}

 setLoading(true);
 
 try {
 const ownership = await ownershipFields();
 let credentialData: Record<string, unknown> = {
 title: formData.title.trim(),
 description: formData.description.trim() || null,
 credential_type: formData.credential_type,
 priority: formData.priority,
 username: formData.username.trim() || null,
 url: formData.url.trim() || null,
 category: formData.category || null,
 notes: formData.notes.trim() || null,
 expires_at: formData.expires_at || null,
 tags,
 ...ownership,
};

 if (enableEncryption && hasSensitiveData()) {
 // Encrypt sensitive data
 const encryptionResult = await vault.encryptCredential({
 password: formData.password.trim() || undefined,
 api_key: formData.api_key.trim() || undefined,
 secret_value: formData.secret_value.trim() || undefined,
 token_value: formData.token_value.trim() || undefined,
 certificate_data: formData.certificate_data.trim() || undefined,
 misc_value: formData.misc_value.trim() || undefined,
 document_name: formData.document_name || undefined,
 document_mime_type: formData.document_mime_type || undefined,
 document_content_base64: formData.document_content_base64 || undefined,
 document_size_bytes: formData.document_size_bytes || undefined,
});

 credentialData = {
 ...credentialData,
 secret_blob: encryptionResult.secret_blob,
 encrypted_at: encryptionResult.encrypted_at,
 // Clear plaintext fields for security
 password: null,
 api_key: null,
 secret_value: null,
 token_value: null,
 certificate_data: null,
 misc_value: null,
 document_name: null,
 document_mime_type: null,
 document_content_base64: null,
 document_size_bytes: null,
};
} else {
 // Store as plaintext (not recommended for production)
 credentialData = {
 ...credentialData,
 password: formData.password.trim() || null,
 api_key: formData.api_key.trim() || null,
 secret_value: formData.secret_value.trim() || null,
 token_value: formData.token_value.trim() || null,
 certificate_data: formData.certificate_data.trim() || null,
 misc_value: formData.misc_value.trim() || null,
 document_name: formData.document_name || null,
 document_mime_type: formData.document_mime_type || null,
 document_content_base64: formData.document_content_base64 || null,
 document_size_bytes: formData.document_size_bytes || null,
 secret_blob: null,
 encrypted_at: null,
};
}

 let error;
 if (isEditing && initialData?.id) {
 ({ error} = await supabase
 .from('credentials')
 .update(credentialData)
 .eq('id', initialData.id)
 );
} else {
 ({ error} = await supabase
 .from('credentials')
 .insert(credentialData)
 );
}

 if (error) throw error;

 toast({
 title: enableEncryption ?"🔐 Encrypted Credential Saved" :"💾 Credential Saved",
 description: `Credential ${isEditing ? 'updated' : 'created'} successfully${enableEncryption ? ' with encryption' : ''}`,
});

 onSave();
} catch (error: unknown) {
 const message = error instanceof Error
 ? error.message
 : `Failed to ${isEditing ? 'update' : 'create'} credential`;
 console.error('Error saving credential:', error);
 toast({
 title:"❌ Save Failed",
 description: message,
 variant:"destructive",
});
} finally {
 setLoading(false);
}
};

 const addTag = () => {
 if (tagInput.trim() && !tags.includes(tagInput.trim())) {
 setTags([...tags, tagInput.trim()]);
 setTagInput('');
}
};

 const removeTag = (tagToRemove: string) => {
 setTags(tags.filter(tag => tag !== tagToRemove));
};

 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (e.key === 'Enter' && tagInput.trim()) {
 e.preventDefault();
 addTag();
}
};

 return (
 <form onSubmit={handleSubmit} className="space-y-6">
 {/* Encryption Settings */}
 <Card>
 <CardHeader className="pb-3">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 {enableEncryption ? (
 <ShieldCheck className="h-5 w-5 text-green-500" />
 ) : (
 <Shield className="h-5 w-5 text-orange-500" />
 )}
 <CardTitle className="text-lg">Security Settings</CardTitle>
 </div>
 <Switch
 checked={enableEncryption}
 onCheckedChange={setEnableEncryption}
 disabled={loading}
 />
 </div>
 <CardDescription>
 {enableEncryption
 ?"Sensitive data will be encrypted before storage"
 :"Data will be stored as plaintext (not recommended)"
}
 </CardDescription>
 </CardHeader>
 
 {showEncryptionWarning && (
 <CardContent className="pt-0">
 <Alert variant="destructive">
 <Lock className="h-4 w-4" />
 <AlertDescription>
 Vault is locked. Unlock the vault to encrypt sensitive data, or disable encryption to continue.
 </AlertDescription>
 </Alert>
 </CardContent>
 )}
 
 {!enableEncryption && hasSensitiveData() && (
 <CardContent className="pt-0">
 <Alert>
 <AlertTriangle className="h-4 w-4" />
 <AlertDescription>
 You have sensitive data that will be stored as plaintext. Consider enabling encryption for better security.
 </AlertDescription>
 </Alert>
 </CardContent>
 )}
 </Card>

 {/* Basic Information */}
 <Card>
 <CardHeader>
 <CardTitle>Basic Information</CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="title">Title *</Label>
 <Input
 id="title"
 value={formData.title}
 onChange={(e) => setFormData({ ...formData, title: e.target.value})}
 placeholder="e.g., GitHub API Key"
 required
 />
 </div>
 
 <div className="space-y-2">
 <Label htmlFor="credential_type">Type</Label>
 <Select
 value={formData.credential_type}
 onValueChange={(value: CredentialType) => 
 setFormData({ ...formData, credential_type: value})
}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {credentialTypes.map((type) => (
 <SelectItem key={type.value} value={type.value}>
 {type.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>

 <div className="space-y-2">
 <Label htmlFor="description">Description</Label>
 <Textarea
 id="description"
 value={formData.description}
 onChange={(e) => setFormData({ ...formData, description: e.target.value})}
 placeholder="Brief description of this credential"
 rows={2}
 />
 </div>
 </CardContent>
 </Card>

 {/* Sensitive Data */}
 <Card>
 <CardHeader>
 <div className="flex items-center gap-2">
 <CardTitle>Sensitive Data</CardTitle>
 {enableEncryption && (
 <Badge variant="default" className="bg-green-500">
 <Lock className="h-3 w-3 mr-1" />
 Encrypted
 </Badge>
 )}
 {!enableEncryption && (
 <Badge variant="destructive">
 <Unlock className="h-3 w-3 mr-1" />
 Plaintext
 </Badge>
 )}
 </div>
 <CardDescription>
 Enter the secret values for this credential
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid grid-cols-1 gap-4">
 <div className="space-y-2">
 <Label htmlFor="username">Username</Label>
 <Input
 id="username"
 value={formData.username}
 onChange={(e) => setFormData({ ...formData, username: e.target.value})}
 placeholder="Username or email"
 />
 </div>

 {formData.credential_type === 'login' && (
 <div className="space-y-2">
 <Label htmlFor="password">Password</Label>
 <Input
 id="password"
 type="password"
 value={formData.password}
 onChange={(e) => setFormData({ ...formData, password: e.target.value})}
 placeholder="Password"
 />
 </div>
 )}

 {formData.credential_type === 'api_key' && (
 <div className="space-y-2">
 <Label htmlFor="api_key">API Key</Label>
 <Input
 id="api_key"
 type="password"
 value={formData.api_key}
 onChange={(e) => setFormData({ ...formData, api_key: e.target.value})}
 placeholder="API Key"
 />
 </div>
 )}

 {formData.credential_type === 'secret' && (
 <div className="space-y-2">
 <Label htmlFor="secret_value">Secret Value</Label>
 <Textarea
 id="secret_value"
 value={formData.secret_value}
 onChange={(e) => setFormData({ ...formData, secret_value: e.target.value})}
 placeholder="Secret value"
 rows={3}
 />
 </div>
 )}

 {formData.credential_type === 'token' && (
 <div className="space-y-2">
 <Label htmlFor="token_value">Token</Label>
 <Textarea
 id="token_value"
 value={formData.token_value}
 onChange={(e) => setFormData({ ...formData, token_value: e.target.value})}
 placeholder="Token value"
 rows={2}
 />
 </div>
 )}

 {formData.credential_type === 'certificate' && (
 <div className="space-y-2">
 <Label htmlFor="certificate_data">Certificate Data</Label>
 <Textarea
 id="certificate_data"
 value={formData.certificate_data}
 onChange={(e) => setFormData({ ...formData, certificate_data: e.target.value})}
 placeholder="Certificate content (PEM format)"
 rows={6}
 />
 </div>
 )}

 {formData.credential_type === 'document' && (
 <div className="space-y-2">
 <Label htmlFor="document_content_base64">Document (base64)</Label>
 <Textarea
 id="document_content_base64"
 value={formData.document_content_base64}
 onChange={(e) => setFormData({ ...formData, document_content_base64: e.target.value})}
 placeholder="Paste base64 document content"
 rows={4}
 />
 </div>
 )}

 {formData.credential_type === 'misc' && (
 <div className="space-y-2">
 <Label htmlFor="misc_value">Sensitive Value</Label>
 <Textarea
 id="misc_value"
 value={formData.misc_value}
 onChange={(e) => setFormData({ ...formData, misc_value: e.target.value})}
 placeholder="Multiline secret value"
 rows={6}
 />
 </div>
 )}
 </div>
 </CardContent>
 </Card>

 {/* Form Actions */}
 <div className="flex justify-end gap-3">
 <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
 Cancel
 </Button>
 <Button type="submit" disabled={loading || showEncryptionWarning}>
 {loading ? (
 <>
 <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
 {isEditing ? 'Updating...' : 'Creating...'}
 </>
 ) : (
 <>
 {enableEncryption && <Lock className="h-4 w-4 mr-2" />}
 {isEditing ? 'Update Credential' : 'Create Credential'}
 </>
 )}
 </Button>
 </div>
 </form>
 );
}
