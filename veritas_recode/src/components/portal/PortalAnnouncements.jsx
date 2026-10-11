import React, { useEffect, useState } from "react";
import { backend } from "@/api/backendClient";
import { Megaphone } from "lucide-react";

export default function PortalAnnouncements({ institutionId }) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!institutionId) return;
    const load = async () => {
      try {
        const list = await backend.entities.MemberMessage.filter(
          { institution_id: institutionId }, "-created_date", 20
        );
        setMessages(list || []);
      } catch {
        setMessages([]);
      }
    };
    load();
    let unsub;
    try { unsub = backend.entities.MemberMessage.subscribe(() => load()); } catch {}
    return () => { if (unsub) unsub(); };
  }, [institutionId]);

  if (messages.length === 0) return null;

  return (
    <div className="bg-slate-900/60 backdrop-blur rounded-2xl border border-amber-800/15 overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-amber-800/10 flex items-center gap-2">
        <Megaphone className="w-5 h-5 text-amber-500" />
        <h3 className="font-semibold text-amber-100">Announcements from your Institution</h3>
      </div>
      <div className="divide-y divide-amber-800/10">
        {messages.map((m) => (
          <div key={m.id} className="px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium text-amber-100">{m.title}</p>
              <span className="text-xs text-slate-500 flex-shrink-0">
                {m.date ? new Date(m.date).toLocaleDateString() : ""}
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-1 whitespace-pre-wrap">{m.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}