import React, { useRef, useState} from 'react';
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogHeader,
 DialogTitle,
} from '@/components/ui/dialog';
import { Button} from '@/components/ui/button';
import { Input} from '@/components/ui/input';
import { Label} from '@/components/ui/label';
import { Textarea} from '@/components/ui/textarea';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import { Badge} from '@/components/ui/badge';
import { useToast} from '@/hooks/use-toast';
import { useEncryption} from '@/hooks/useVault';
import { supabase} from '@/integrations/supabase/client';
import { ownershipFields} from '@/integrations/supabase/auth';
import { X, Plus, Upload, FileText, Trash2} from 'lucide-react';
import { Checkbox} from '@/components/ui/checkbox';
import { Category} from '../SelfHostedDashboard';

interface AddCredentialModalProps {
 isOpen: boolean;
 onClose: () => void;
 categories: Category[];
 onCredentialAdded: () => void;
}

type CredentialType =
 | 'api_key'
 | 'login'
 | 'secret'
 | 'token'
 | 'certificate'
 | 'document'
 | 'misc';
type Priority = 'low' | 'medium' | 'high' | 'critical';

const DOCUMENT_ACCEPT = '.pdf,.doc,.docx,.odt,.txt,.md';
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

function bytesToBase64(bytes: Uint8Array): string {
 let binary = '';
 const chunkSize = 0x8000;
 for (let i = 0; i < bytes.length; i += chunkSize) {
 binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
}
 return btoa(binary);
}

function formatBytes(bytes: number): string {
 if (bytes < 1024) return `${bytes} B`;
 if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
 return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const AddCredentialModal = ({
 isOpen,
 onClose,
 categories,
 onCredentialAdded,
}: AddCredentialModalProps) => {
 const [formData, setFormData] = useState({
 title: '',
 description: '',
 credential_type: 'api_key' as CredentialType,
 priority: 'medium' as Priority,
 username: '',
 password: '',
 api_key: '',
 secret_value: '',
 token_value: '',
 certificate_data: '',
 misc_value: '',
 document_name: '',
 document_mime_type: '',
 document_content_base64: '',
 document_size_bytes: 0,
 url: '',
 category: '',
 notes: '',
 expires_at: '',
});
 const [tags, setTags] = useState<string[]>([]);
 const [tagInput, setTagInput] = useState('');
 const [noExpiration, setNoExpiration] = useState(false);
 const [loading, setLoading] = useState(false);
 const certificateFileInputRef = useRef<HTMLInputElement>(null);
 const documentFileInputRef = useRef<HTMLInputElement>(null);
 const { toast} = useToast();
 const { encryptCredential, isUnlocked} = useEncryption();

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

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!formData.title.trim()) {
 toast({
 title: 'Error',
 description: 'Title is required',
 variant: 'destructive',
});
 return;
}
 if (formData.credential_type === 'certificate' && !formData.certificate_data.trim()) {
 toast({
 title: 'Error',
 description: 'Certificate content is required for certificate credentials',
 variant: 'destructive',
});
 return;
}
 if (formData.credential_type === 'document' && !formData.document_content_base64) {
 toast({
 title: 'Error',
 description: 'Please upload a document before saving this credential',
 variant: 'destructive',
});
 return;
}
 if (formData.credential_type === 'misc' && !formData.misc_value.trim()) {
 toast({
 title: 'Error',
 description: 'Please enter a value for this miscellaneous credential',
 variant: 'destructive',
});
 return;
}

 if (!isUnlocked) {
 toast({
 title: 'Error',
 description: 'Vault must be unlocked to add credentials',
 variant: 'destructive',
});
 return;
}

 setLoading(true);
 try {
 const ownership = await ownershipFields();
 const secretsByType = (() => {
 switch (formData.credential_type) {
 case 'login':
 return { password: formData.password.trim() || undefined};
 case 'api_key':
 return { api_key: formData.api_key.trim() || undefined};
 case 'secret':
 return { secret_value: formData.secret_value.trim() || undefined};
 case 'token':
 return { token_value: formData.token_value.trim() || undefined};
 case 'certificate':
 return { certificate_data: formData.certificate_data.trim() || undefined};
 case 'document':
 return {
 document_name: formData.document_name || undefined,
 document_mime_type: formData.document_mime_type || undefined,
 document_content_base64: formData.document_content_base64 || undefined,
 document_size_bytes: formData.document_size_bytes || undefined,
};
 case 'misc':
 return { misc_value: formData.misc_value.trim() || undefined};
 default:
 return {};
}
})();

 const { secret_blob, encrypted_at} = await encryptCredential(secretsByType);

 const { error} = await supabase.from('credentials').insert({
 ...ownership,
 title: formData.title.trim(),
 description: formData.description.trim() || null,
 credential_type: formData.credential_type,
 priority: formData.priority,
 username: formData.username.trim() || null,
 url: formData.url.trim() || null,
 tags,
 category: formData.category || null,
 notes: formData.notes.trim() || null,
 expires_at: formData.expires_at || null,
 secret_blob,
 encrypted_at,
});

 if (error) throw error;

 toast({
 title: 'Success',
 description: 'Credential added successfully',
});

 onCredentialAdded();
 onClose();
 resetForm();
} catch (error: unknown) {
 console.error('Error adding credential:', error);
 const message = error instanceof Error ? error.message : 'Failed to add credential';
 toast({
 title: 'Error',
 description: message,
 variant: 'destructive',
});
} finally {
 setLoading(false);
}
};

 const resetForm = () => {
 setFormData({
 title: '',
 description: '',
 credential_type: 'api_key',
 priority: 'medium',
 username: '',
 password: '',
 api_key: '',
 secret_value: '',
 token_value: '',
 certificate_data: '',
 misc_value: '',
 document_name: '',
 document_mime_type: '',
 document_content_base64: '',
 document_size_bytes: 0,
 url: '',
 category: '',
 notes: '',
 expires_at: '',
});
 setTags([]);
 setTagInput('');
 setNoExpiration(false);
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
 if (e.key === 'Enter') {
 e.preventDefault();
 addTag();
}
};

 const handleCertificateFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;

 try {
 const content = await file.text();
 setFormData((prev) => ({ ...prev, certificate_data: content}));
 toast({
 title: 'Certificate loaded',
 description: `${file.name} is ready to save.`,
});
} catch (error) {
 console.error('Error reading certificate file:', error);
 toast({
 title: 'Upload failed',
 description: 'Could not read certificate file. Please paste content instead.',
 variant: 'destructive',
});
} finally {
 e.target.value = '';
}
};

 const handleDocumentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;

 if (file.size > MAX_DOCUMENT_BYTES) {
 toast({
 title: 'File too large',
 description: `Document exceeds ${formatBytes(MAX_DOCUMENT_BYTES)} limit.`,
 variant: 'destructive',
});
 e.target.value = '';
 return;
}

 try {
 const buffer = await file.arrayBuffer();
 const base64 = bytesToBase64(new Uint8Array(buffer));
 setFormData((prev) => ({
 ...prev,
 document_name: file.name,
 document_mime_type: file.type || 'application/octet-stream',
 document_content_base64: base64,
 document_size_bytes: file.size,
}));
 toast({
 title: 'Document loaded',
 description: `${file.name} is ready to save.`,
});
} catch (error) {
 console.error('Error reading document file:', error);
 toast({
 title: 'Upload failed',
 description: 'Could not read document file.',
 variant: 'destructive',
});
} finally {
 e.target.value = '';
}
};

 const clearDocument = () => {
 setFormData((prev) => ({
 ...prev,
 document_name: '',
 document_mime_type: '',
 document_content_base64: '',
 document_size_bytes: 0,
}));
};

 return (
 <Dialog open={isOpen} onOpenChange={onClose}>
 <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background border-border text-foreground">
 <DialogHeader>
 <DialogTitle className="text-xl font-semibold text-foreground">
 Add New Credential
 </DialogTitle>
 <DialogDescription className="text-muted-foreground">
 Store and organize your digital credentials securely
 </DialogDescription>
 </DialogHeader>

 <form onSubmit={handleSubmit} className="space-y-6">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="title" className="text-foreground">Title *</Label>
 <Input
 id="title"
 value={formData.title}
 onChange={(e) => setFormData({ ...formData, title: e.target.value})}
 className="bg-background border-border focus:ring-1 focus:ring-neutral-500 text-foreground"
 placeholder="e.g., GitHub API Key"
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="type" className="text-foreground">Type</Label>
 <Select
 value={formData.credential_type}
 onValueChange={(value: CredentialType) => setFormData({ ...formData, credential_type: value})}
 >
 <SelectTrigger className="bg-background border-border focus:ring-1 focus:ring-neutral-500 text-foreground">
 <SelectValue />
 </SelectTrigger>
 <SelectContent className="bg-background border-border focus:ring-1 focus:ring-neutral-500">
 {credentialTypes.map((type) => (
 <SelectItem key={type.value} value={type.value} className="text-foreground">
 {type.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>

 <div className="space-y-2">
 <Label htmlFor="description" className="text-foreground">Description</Label>
 <Textarea
 id="description"
 value={formData.description}
 onChange={(e) => setFormData({ ...formData, description: e.target.value})}
 className="bg-background border-border focus:ring-1 focus:ring-neutral-500 text-foreground"
 placeholder="Brief description of this credential"
 rows={2}
 />
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {formData.credential_type === 'login' && (
 <>
 <div className="space-y-2">
 <Label htmlFor="username" className="text-foreground">Username</Label>
 <Input
 id="username"
 value={formData.username}
 onChange={(e) => setFormData({ ...formData, username: e.target.value})}
 className="bg-background border-border focus:ring-1 focus:ring-neutral-500 text-foreground"
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="password" className="text-foreground">Password</Label>
 <Input
 id="password"
 type="password"
 value={formData.password}
 onChange={(e) => setFormData({ ...formData, password: e.target.value})}
 className="bg-background border-border focus:ring-1 focus:ring-neutral-500 text-foreground"
 />
 </div>
 </>
 )}

 {formData.credential_type === 'api_key' && (
 <div className="md:col-span-2 space-y-2">
 <Label htmlFor="api_key" className="text-foreground">API Key</Label>
 <Input
 id="api_key"
 type="password"
 value={formData.api_key}
 onChange={(e) => setFormData({ ...formData, api_key: e.target.value})}
 className="bg-background border-border focus:ring-1 focus:ring-neutral-500 text-foreground"
 />
 </div>
 )}

 {(formData.credential_type === 'secret' || formData.credential_type === 'token') && (
 <div className="md:col-span-2 space-y-2">
 <Label htmlFor="secret_value" className="text-foreground">
 {formData.credential_type === 'secret' ? 'Secret Value' : 'Token'}
 </Label>
 <Input
 id="secret_value"
 type="password"
 value={formData.credential_type === 'secret' ? formData.secret_value : formData.token_value}
 onChange={(e) =>
 setFormData({
 ...formData,
 ...(formData.credential_type === 'secret'
 ? { secret_value: e.target.value}
 : { token_value: e.target.value}),
})
}
 className="bg-background border-border focus:ring-1 focus:ring-neutral-500 text-foreground"
 />
 </div>
 )}

 {formData.credential_type === 'certificate' && (
 <div className="md:col-span-2 space-y-2">
 <div className="flex items-center justify-between gap-3">
 <Label htmlFor="certificate_data" className="text-foreground">Certificate Data</Label>
 <>
 <input
 ref={certificateFileInputRef}
 type="file"
 accept=".pem,.crt,.cer,.txt"
 className="hidden"
 onChange={handleCertificateFileUpload}
 />
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => certificateFileInputRef.current?.click()}
 className="border-input text-foreground hover:bg-accent hover:text-accent-foreground"
 >
 <Upload className="h-4 w-4 mr-2" />
 Upload File
 </Button>
 </>
 </div>
 <Textarea
 id="certificate_data"
 value={formData.certificate_data}
 onChange={(e) => setFormData({ ...formData, certificate_data: e.target.value})}
 className="bg-background border-border focus:ring-1 focus:ring-neutral-500 text-foreground font-mono text-sm"
 placeholder="Paste certificate content here (PEM format)"
 rows={7}
 />
 </div>
 )}

 {formData.credential_type === 'document' && (
 <div className="md:col-span-2 space-y-3">
 <div className="flex items-center justify-between gap-3">
 <Label className="text-foreground">Document</Label>
 <input
 ref={documentFileInputRef}
 type="file"
 accept={DOCUMENT_ACCEPT}
 className="hidden"
 onChange={handleDocumentFileUpload}
 />
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => documentFileInputRef.current?.click()}
 className="border-input text-foreground hover:bg-accent hover:text-accent-foreground"
 >
 <Upload className="h-4 w-4 mr-2" />
 Upload Document
 </Button>
 </div>

 {formData.document_name ? (
 <div className="flex items-center justify-between rounded-md border border-border bg-muted/70 px-3 py-2">
 <div className="min-w-0">
 <p className="text-sm text-neutral-100 truncate flex items-center gap-2">
 <FileText className="h-4 w-4 text-foreground" />
 {formData.document_name}
 </p>
 <p className="text-xs text-muted-foreground">
 {formatBytes(formData.document_size_bytes)}
 </p>
 </div>
 <Button
 type="button"
 variant="ghost"
 size="icon"
 onClick={clearDocument}
 className="text-muted-foreground hover:bg-accent hover:text-accent-foreground"
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 </div>
 ) : (
 <p className="text-xs text-muted-foreground">
 Supported: PDF, DOC, DOCX, ODT, TXT, MD (up to {formatBytes(MAX_DOCUMENT_BYTES)}).
 </p>
 )}
 </div>
 )}

 {formData.credential_type === 'misc' && (
 <div className="md:col-span-2 space-y-2">
 <Label htmlFor="misc_value" className="text-foreground">Sensitive Value</Label>
 <Textarea
 id="misc_value"
 value={formData.misc_value}
 onChange={(e) => setFormData({ ...formData, misc_value: e.target.value})}
 className="bg-background border-border focus:ring-1 focus:ring-neutral-500 text-foreground font-mono text-sm"
 placeholder="Paste any sensitive multiline text, scripts, or commands here"
 rows={8}
 />
 </div>
 )}

 <div className="space-y-2">
 <Label htmlFor="url" className="text-foreground">URL</Label>
 <Input
 id="url"
 value={formData.url}
 onChange={(e) => setFormData({ ...formData, url: e.target.value})}
 className="bg-background border-border focus:ring-1 focus:ring-neutral-500 text-foreground"
 placeholder="https://example.com"
 />
 </div>

 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <Label htmlFor="expires_at" className="text-foreground">Expires At</Label>
 <div className="flex items-center gap-2">
 <Checkbox
 id="no_expiration"
 checked={noExpiration}
 onCheckedChange={(checked) => {
 setNoExpiration(!!checked);
 if (checked) setFormData({ ...formData, expires_at: ''});
}}
 className="border-primary data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground"
 />
 <Label htmlFor="no_expiration" className="text-muted-foreground text-xs cursor-pointer">No expiration</Label>
 </div>
 </div>
 <Input
 id="expires_at"
 type="date"
 value={formData.expires_at}
 onChange={(e) => setFormData({ ...formData, expires_at: e.target.value})}
 disabled={noExpiration}
 className="bg-background border-border focus:ring-1 focus:ring-neutral-500 text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
 />
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="category" className="text-foreground">Category</Label>
 <Select
 value={formData.category}
 onValueChange={(value) => setFormData({ ...formData, category: value})}
 >
 <SelectTrigger className="bg-background border-border focus:ring-1 focus:ring-neutral-500 text-foreground">
 <SelectValue placeholder="Select category" />
 </SelectTrigger>
 <SelectContent className="bg-background border-border focus:ring-1 focus:ring-neutral-500">
 {categories.map((category) => (
 <SelectItem key={category.id} value={category.name} className="text-foreground">
 {category.name}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label htmlFor="priority" className="text-foreground">Priority</Label>
 <Select
 value={formData.priority}
 onValueChange={(value: Priority) => setFormData({ ...formData, priority: value})}
 >
 <SelectTrigger className="bg-background border-border focus:ring-1 focus:ring-neutral-500 text-foreground">
 <SelectValue />
 </SelectTrigger>
 <SelectContent className="bg-background border-border focus:ring-1 focus:ring-neutral-500">
 {priorities.map((priority) => (
 <SelectItem key={priority.value} value={priority.value} className="text-foreground">
 {priority.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>

 <div className="space-y-2">
 <Label className="text-foreground">Tags</Label>
 <div className="flex items-center space-x-2">
 <Input
 value={tagInput}
 onChange={(e) => setTagInput(e.target.value)}
 onKeyDown={handleKeyDown}
 className="bg-background border-border focus:ring-1 focus:ring-neutral-500 text-foreground"
 placeholder="Add a tag"
 />
 <Button
 type="button"
 onClick={addTag}
 size="sm"
 className="bg-primary text-primary-foreground hover:bg-primary/90"
 >
 <Plus className="h-4 w-4" />
 </Button>
 </div>
 {tags.length > 0 && (
 <div className="flex flex-wrap gap-2 mt-2">
 {tags.map((tag) => (
 <Badge
 key={tag}
 variant="secondary"
 className="bg-primary/10 text-primary border-primary/25"
 >
 {tag}
 <button
 type="button"
 onClick={() => removeTag(tag)}
 className="ml-1"
 >
 <X className="h-3 w-3" />
 </button>
 </Badge>
 ))}
 </div>
 )}
 </div>

 <div className="space-y-2">
 <Label htmlFor="notes" className="text-foreground">Notes</Label>
 <Textarea
 id="notes"
 value={formData.notes}
 onChange={(e) => setFormData({ ...formData, notes: e.target.value})}
 className="bg-background border-border focus:ring-1 focus:ring-neutral-500 text-foreground"
 placeholder="Additional notes about this credential"
 rows={3}
 />
 </div>

 <div className="flex justify-end space-x-2 pt-4">
 <Button
 type="button"
 variant="outline"
 onClick={onClose}
 className="border-input text-foreground hover:bg-accent hover:text-accent-foreground"
 >
 Cancel
 </Button>
 <Button
 type="submit"
 disabled={loading}
 className="bg-primary text-primary-foreground hover:bg-primary/90"
 >
 {loading ? 'Adding...' : 'Add Credential'}
 </Button>
 </div>
 </form>
 </DialogContent>
 </Dialog>
 );
};
