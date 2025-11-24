import { useEffect } from 'react';
import { Layout } from './components/Layout';
import { RecordTab } from './components/tabs/RecordTab';
import { AnalyticsTab } from './components/tabs/AnalyticsTab';
import { ChatTab } from './components/tabs/ChatTab';
import { CalendarTab } from './components/tabs/CalendarTab';
import { useStore } from './store';
import { ThemeProvider } from './context/ThemeContext';

function App() {
  const { activeTab, loadSettings, refreshLogs } = useStore();

  useEffect(() => {
    loadSettings();
    refreshLogs();
  }, [loadSettings, refreshLogs]);

  const renderTab = () => {
    switch (activeTab) {
      case 0: return <RecordTab />;
      case 1: return <AnalyticsTab />;
      case 2: return <ChatTab />;
      case 3: return <CalendarTab />;
      default: return <RecordTab />;
    }
  };

  return (
    <ThemeProvider>
      <Layout>
        {renderTab()}
      </Layout>
    </ThemeProvider>
  );
}

export default App;
