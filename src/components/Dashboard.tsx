import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TemplateGrid } from "./TemplateGrid";
import { MemeEditor } from "./MemeEditor";
import { AdminPanel } from "./AdminPanel";

export interface Template {
  id: string;
  name: string;
  type: 'photo' | 'video';
  url: string;
  thumbnail_url?: string;
}

export const Dashboard = () => {
  const [activeTab, setActiveTab] = useState<'photo' | 'video'>('photo');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  const handleEditTemplate = (template: Template) => {
    setSelectedTemplate(template);
  };

  const handleBackToGrid = () => {
    setSelectedTemplate(null);
  };

  const handleCreateTemplate = () => {
    setShowAdminPanel(true);
  };

  const handleCloseAdminPanel = () => {
    setShowAdminPanel(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <Sidebar 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          onCreateTemplate={handleCreateTemplate}
        />
        
        {/* Main Content */}
        <main className="flex-1 p-6">
          {selectedTemplate ? (
            <MemeEditor 
              template={selectedTemplate} 
              onBack={handleBackToGrid}
            />
          ) : (
            <TemplateGrid 
              type={activeTab} 
              onEditTemplate={handleEditTemplate}
            />
          )}
        </main>
      </div>

      {/* Admin Panel Modal */}
      {showAdminPanel && (
        <AdminPanel onClose={handleCloseAdminPanel} />
      )}
    </div>
  );
};