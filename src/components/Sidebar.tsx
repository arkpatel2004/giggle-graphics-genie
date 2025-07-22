import { Image, Video, Plus, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface SidebarProps {
  activeTab: 'photo' | 'video';
  onTabChange: (tab: 'photo' | 'video') => void;
  onCreateTemplate: () => void;
}

export const Sidebar = ({ activeTab, onTabChange, onCreateTemplate }: SidebarProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      {/* Hamburger Menu Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="fixed top-4 left-4 z-50 p-2 bg-card border border-border rounded-lg shadow-lg hover:bg-accent transition-colors"
      >
        {isExpanded ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Sidebar */}
      <div 
        className={`fixed left-0 top-0 h-full bg-card border-r border-border transition-all duration-300 z-40 ${
          isExpanded ? 'w-64' : 'w-16'
        }`}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        <div className={`space-y-6 pt-16 ${isExpanded ? 'p-6' : 'p-2'}`}>
          {/* Logo/Header */}
          <div className="text-center">
            {isExpanded ? (
              <>
                <h1 className="text-2xl font-bold gradient-text">
                  Meme Creator
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Create amazing memes
                </p>
              </>
            ) : (
              <div className="w-8 h-8 mx-auto bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">M</span>
              </div>
            )}
          </div>

          {/* Navigation Menu */}
          <nav className="space-y-2">
            <button
              onClick={() => onTabChange('photo')}
              className={`sidebar-item w-full text-left ${
                activeTab === 'photo' ? 'active' : ''
              } ${!isExpanded ? 'justify-center p-2' : ''}`}
              title={!isExpanded ? 'Photo Templates' : ''}
            >
              <Image className="w-5 h-5" />
              {isExpanded && <span className="font-medium">Photo Templates</span>}
            </button>

            <button
              onClick={() => onTabChange('video')}
              className={`sidebar-item w-full text-left ${
                activeTab === 'video' ? 'active' : ''
              } ${!isExpanded ? 'justify-center p-2' : ''}`}
              title={!isExpanded ? 'Video Templates' : ''}
            >
              <Video className="w-5 h-5" />
              {isExpanded && <span className="font-medium">Video Templates</span>}
            </button>
          </nav>

          {/* Create Template Button */}
          <div className="pt-4 border-t border-border">
            <Button
              onClick={onCreateTemplate}
              className={`w-full btn-gradient text-primary-foreground ${
                !isExpanded ? 'p-2 aspect-square' : ''
              }`}
              title={!isExpanded ? 'Create Template' : ''}
            >
              <Plus className={`w-4 h-4 ${isExpanded ? 'mr-2' : ''}`} />
              {isExpanded && 'Create Template'}
            </Button>
          </div>

          {/* Footer */}
          {isExpanded && (
            <div className="text-xs text-muted-foreground text-center pt-8">
              <p>Admin access required for template creation</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};