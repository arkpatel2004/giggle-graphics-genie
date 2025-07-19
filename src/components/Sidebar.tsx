import { Image, Video, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  activeTab: 'photo' | 'video';
  onTabChange: (tab: 'photo' | 'video') => void;
  onCreateTemplate: () => void;
}

export const Sidebar = ({ activeTab, onTabChange, onCreateTemplate }: SidebarProps) => {
  return (
    <div className="w-64 bg-card border-r border-border p-6 space-y-6">
      {/* Logo/Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold gradient-text">
          Meme Creator
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create amazing memes
        </p>
      </div>

      {/* Navigation Menu */}
      <nav className="space-y-2">
        <button
          onClick={() => onTabChange('photo')}
          className={`sidebar-item w-full text-left ${
            activeTab === 'photo' ? 'active' : ''
          }`}
        >
          <Image className="w-5 h-5" />
          <span className="font-medium">Photo Templates</span>
        </button>

        <button
          onClick={() => onTabChange('video')}
          className={`sidebar-item w-full text-left ${
            activeTab === 'video' ? 'active' : ''
          }`}
        >
          <Video className="w-5 h-5" />
          <span className="font-medium">Video Templates</span>
        </button>
      </nav>

      {/* Create Template Button */}
      <div className="pt-4 border-t border-border">
        <Button
          onClick={onCreateTemplate}
          className="w-full btn-gradient text-primary-foreground"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Footer */}
      <div className="text-xs text-muted-foreground text-center pt-8">
        <p>Admin access required for template creation</p>
      </div>
    </div>
  );
};