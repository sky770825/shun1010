import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { RosterPage } from "@/components/roster/RosterPage";
import { DutyPage } from "@/components/duty/DutyPage";
import { ToolsPage } from "@/components/tools/ToolsPage";
import { initializeDemoData } from "@/services/dataService";
import { Toaster } from "@/components/ui/toaster";

const Index = () => {
  const [activeTab, setActiveTab] = useState<'roster' | 'duty' | 'tools'>('roster');

  // Initialize demo data on first load
  useEffect(() => {
    void initializeDemoData().catch(console.error);
  }, []);

  return (
    <AppLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'roster' && <RosterPage />}
      {activeTab === 'duty' && <DutyPage onNavigateToRoster={() => setActiveTab('roster')} />}
      {activeTab === 'tools' && <ToolsPage />}
    </AppLayout>
  );
};

export default Index;
