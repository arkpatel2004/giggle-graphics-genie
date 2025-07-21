import { useState } from "react";
import { X, Upload, User, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdminPanelProps {
  onClose: () => void;
}

export const AdminPanel = ({ onClose }: AdminPanelProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateType, setTemplateType] = useState<'photo' | 'video'>('photo');
  const [templateUrl, setTemplateUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      toast.error("Please enter username and password");
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('admin_credentials')
        .select('*')
        .eq('username', username)
        .single();

      if (error || !data) {
        toast.error("Invalid credentials");
        return;
      }

      // Simple password check (in production, use proper password hashing)
      if (password === 'admin123') {
        setIsAuthenticated(true);
        toast.success("Admin access granted!");
      } else {
        toast.error("Invalid credentials");
      }
    } catch (error) {
      toast.error("Authentication failed");
      console.error('Auth error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!templateName || !templateUrl) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('templates')
        .insert({
          name: templateName,
          type: templateType,
          url: templateUrl,
          thumbnail_url: thumbnailUrl || templateUrl,
        });

      if (error) {
        toast.error("Failed to create template");
        console.error('Error:', error);
        return;
      }

      toast.success("Template created successfully!");
      setTemplateName("");
      setTemplateUrl("");
      setThumbnailUrl("");
      onClose();
    } catch (error) {
      toast.error("Failed to create template");
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold">Admin Panel</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-6">
          {!isAuthenticated ? (
            // Login Form
            <div className="space-y-4">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Admin Authentication</h3>
                <p className="text-sm text-muted-foreground">
                  Enter your admin credentials to continue
                </p>
              </div>

              <div>
                <Label htmlFor="admin-username">Username</Label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="admin-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="admin-password">Password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="admin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="pl-10"
                  />
                </div>
              </div>

              <Button
                onClick={handleLogin}
                disabled={loading}
                className="w-full btn-gradient text-primary-foreground"
              >
                {loading ? "Authenticating..." : "Login as Admin"}
              </Button>

              <div className="text-xs text-muted-foreground text-center">
                Default credentials: admin / admin123
              </div>
            </div>
          ) : (
            // Template Creation Form
            <div className="space-y-4">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-8 h-8 text-secondary" />
                </div>
                <h3 className="text-lg font-semibold">Create New Template</h3>
                <p className="text-sm text-muted-foreground">
                  Add a new meme template to the collection
                </p>
              </div>

              <div>
                <Label htmlFor="template-name">Template Name *</Label>
                <Input
                  id="template-name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Enter template name"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="template-type">Template Type *</Label>
                <Select value={templateType} onValueChange={(value: 'photo' | 'video') => setTemplateType(value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="photo">Photo</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="template-url">Template URL *</Label>
                <Input
                  id="template-url"
                  value={templateUrl}
                  onChange={(e) => setTemplateUrl(e.target.value)}
                  placeholder="https://example.com/template.jpg"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="thumbnail-url">Thumbnail URL (optional)</Label>
                <Input
                  id="thumbnail-url"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder="https://example.com/thumbnail.jpg"
                  className="mt-1"
                />
              </div>

              <Button
                onClick={handleCreateTemplate}
                disabled={loading}
                className="w-full btn-secondary-gradient text-secondary-foreground"
              >
                {loading ? "Creating..." : "Create Template"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};