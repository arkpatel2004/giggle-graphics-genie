import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TemplateGrid } from "./TemplateGrid";
import { MemeEditor } from "./MemeEditor";
import { TemplateCreator } from "./TemplateCreator";

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
  const [showTemplateCreator, setShowTemplateCreator] = useState(false);

  const handleEditTemplate = (template: Template) => {
    setSelectedTemplate(template);
  };

  const handleBackToGrid = () => {
    setSelectedTemplate(null);
  };

  const handleCreateTemplate = () => {
    setShowTemplateCreator(true);
  };

  const handleCloseTemplateCreator = () => {
    setShowTemplateCreator(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        onCreateTemplate={handleCreateTemplate}
      />
      
      {/* Main Content */}
      <main className="ml-16 p-6 min-h-screen">
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

      {/* Template Creator Modal */}
      {showTemplateCreator && (
        <TemplateCreator onClose={handleCloseTemplateCreator} />
      )}
    </div>
  );
};