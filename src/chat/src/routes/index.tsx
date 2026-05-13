import { createSignal } from 'solid-js';
import Sidebar from '~/components/Sidebar';
import ChatArea from '~/components/ChatArea';
import SettingsPanel from '~/components/SettingsPanel';

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = createSignal(true);
  const [settingsOpen, setSettingsOpen] = createSignal(false);

  return (
    <div class="flex h-screen bg-base-100">
      <Sidebar
        onToggle={setSidebarOpen}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <ChatArea
        sidebarOpen={sidebarOpen()}
        onToggleSidebar={() => setSidebarOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <SettingsPanel
        isOpen={settingsOpen()}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
