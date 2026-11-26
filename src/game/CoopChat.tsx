import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, X, Sparkles, Heart, ShieldAlert, Car } from "lucide-react";

export interface ChatMessage {
  id: string;
  sender: "mira" | "leo";
  senderName: string;
  text: string;
  timestamp: number;
}

export const QUICK_CHAT_PRESETS = [
  { text: "Follow me! ❤️", icon: Heart },
  { text: "Meet at Villa Sanctuary 🌴", icon: Sparkles },
  { text: "Cops on me! Need backup! 🚔", icon: ShieldAlert },
  { text: "Hop in the car! 🚗", icon: Car },
  { text: "Look at my outfit! ✨", icon: Sparkles },
  { text: "Found some cash! 💰", icon: Sparkles },
];

interface CoopChatProps {
  isOpen: boolean;
  onClose: () => void;
  character: "mira" | "leo";
  activeRoom: string | null;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  unreadCount: number;
  onOpen: () => void;
  lastMessage: ChatMessage | null;
}

export function CoopChat({
  isOpen,
  onClose,
  character,
  activeRoom,
  messages,
  onSendMessage,
  unreadCount,
  onOpen,
  lastMessage,
}: CoopChatProps) {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInputText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Partner Notification Toast (appears when chat is closed and partner texts) */}
      {!isOpen && lastMessage && lastMessage.sender !== character && (
        <div
          onClick={onOpen}
          className="pointer-events-auto fixed bottom-24 right-4 z-40 max-w-xs bg-black/90 backdrop-blur-md border border-amber-400/50 p-3 rounded-2xl shadow-2xl flex items-center gap-3 cursor-pointer animate-in slide-in-from-right duration-300 active:scale-95"
        >
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs text-white uppercase shadow-md shrink-0 ${
              lastMessage.sender === "mira"
                ? "bg-gradient-to-tr from-rose-600 to-amber-600"
                : "bg-gradient-to-tr from-cyan-600 to-blue-600"
            }`}
          >
            {lastMessage.sender[0]}
          </div>
          <div className="overflow-hidden">
            <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
              {lastMessage.senderName} says:
            </div>
            <div className="text-xs text-white font-medium truncate">{lastMessage.text}</div>
          </div>
        </div>
      )}

      {/* Main Chat Drawer / Window */}
      {isOpen && (
        <div className="pointer-events-auto fixed inset-0 sm:inset-auto sm:bottom-20 sm:right-6 sm:w-96 sm:h-[480px] z-50 flex flex-col bg-neutral-950/95 border border-white/20 sm:rounded-2xl shadow-2xl backdrop-blur-lg overflow-hidden text-white animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-3.5 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider">Two-Player Chat</h3>
                <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {activeRoom ? `Room: ${activeRoom}` : "Solo / Offline"}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-white/40 p-4">
                <Heart className="w-8 h-8 text-rose-500/40 mb-2 animate-pulse" />
                <p className="font-semibold">No messages yet</p>
                <p className="text-[11px] text-white/30 mt-1">
                  Tap a quick preset below or type a message to your partner!
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender === character;
                const timeString = new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    <div className="text-[10px] text-white/50 mb-0.5 px-1 font-semibold flex items-center gap-1">
                      <span>{isMe ? "You" : msg.senderName}</span>
                      <span className="text-[9px] text-white/30 font-normal">{timeString}</span>
                    </div>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2 shadow-md ${
                        isMe
                          ? msg.sender === "mira"
                            ? "bg-gradient-to-r from-rose-600 to-rose-700 text-white rounded-br-xs"
                            : "bg-gradient-to-r from-cyan-600 to-blue-700 text-white rounded-br-xs"
                          : "bg-neutral-800 text-white border border-white/10 rounded-bl-xs"
                      }`}
                    >
                      <p className="font-medium leading-relaxed break-words">{msg.text}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Presets */}
          <div className="px-3 py-2 border-t border-white/10 bg-white/5 flex gap-1.5 overflow-x-auto no-scrollbar">
            {QUICK_CHAT_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSendMessage(preset.text)}
                className="shrink-0 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-neutral-200 border border-white/10 transition active:scale-95"
              >
                {preset.text}
              </button>
            ))}
          </div>

          {/* Input & Send Form */}
          <div className="p-3 border-t border-white/10 bg-black/60 flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={(e) => e.stopPropagation()}
              placeholder="Type message to partner..."
              className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-amber-400"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!inputText.trim()}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-black px-3.5 h-8.5 rounded-xl transition shadow-lg shrink-0 flex items-center justify-center active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
