import { Plus, Trash, ChatCircle } from "@phosphor-icons/react";
import { Button } from "@/components/button/Button";

interface Chat {
  id: string;
  title: string;
  createdAt: Date;
}

interface ChatSidebarProps {
  chats: Chat[];
  currentChatId: string;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function ChatSidebar({
  chats,
  currentChatId,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  isOpen,
  onClose
}: ChatSidebarProps) {
  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-neutral-50 dark:bg-neutral-900 border-r border-neutral-300 dark:border-neutral-800 z-50 transform transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 lg:relative lg:z-0`}
      >
        <div className="flex flex-col h-full">
          {/* Header with New Chat button */}
          <div className="p-4 border-b border-neutral-300 dark:border-neutral-800">
            <Button
              onClick={onNewChat}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-[#F48120] hover:bg-[#e07010] text-white rounded-md transition-colors"
            >
              <Plus size={20} weight="bold" />
              <span>New Chat</span>
            </Button>
          </div>

          {/* Chat list */}
          <div className="flex-1 overflow-y-auto p-2">
            {chats.length === 0 ? (
              <div className="text-center text-neutral-500 dark:text-neutral-400 text-sm p-4">
                No chats yet. Start a new one!
              </div>
            ) : (
              chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`group relative flex items-center gap-2 p-3 rounded-md cursor-pointer transition-colors mb-1 ${
                    chat.id === currentChatId
                      ? "bg-neutral-200 dark:bg-neutral-800"
                      : "hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
                  }`}
                  onClick={() => onSelectChat(chat.id)}
                >
                  <ChatCircle
                    size={18}
                    className="text-neutral-600 dark:text-neutral-400 flex-shrink-0"
                  />
                  <span className="flex-1 text-sm truncate text-neutral-800 dark:text-neutral-200">
                    {chat.title}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(chat.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-opacity"
                    title="Delete chat"
                  >
                    <Trash
                      size={16}
                      className="text-red-600 dark:text-red-400"
                    />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer with chat count */}
          <div className="p-4 border-t border-neutral-300 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400 text-center">
            {chats.length} {chats.length === 1 ? "chat" : "chats"}
          </div>
        </div>
      </div>
    </>
  );
}

