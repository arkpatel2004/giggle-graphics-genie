import { useState } from "react";
import { X, Upload, User, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TemplateEditor } from "./TemplateEditor";

interface AdminPanelProps {
  onClose: () => void;
}

export const AdminPanel = ({ onClose }: AdminPanelProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
        setShowEditor(true);
        toast.success("Admin access granted! Opening template editor...");
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

  const handleEditorSave = () => {
    // This will be called when a template is saved from the editor
    setShowEditor(false);
    setIsAuthenticated(false);
    onClose();
  };

  const handleEditorClose = () => {
    setShowEditor(false);
    setIsAuthenticated(false);
  };

  // Show template editor if authenticated and editor is open
  if (showEditor) {
    return (
      <TemplateEditor
        onClose={handleEditorClose}
        onSave={handleEditorSave}
      />
    );
  }

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
          {/* Login Form */}
          <div className="space-y-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Admin Authentication</h3>
              <p className="text-sm text-muted-foreground">
                Enter your admin credentials to access the template editor
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
              {loading ? "Authenticating..." : "Open Template Editor"}
            </Button>

            <div className="text-xs text-muted-foreground text-center">
              Default credentials: admin / admin123
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};