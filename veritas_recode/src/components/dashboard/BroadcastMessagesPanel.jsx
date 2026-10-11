import React, { useEffect, useState } from "react";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Megaphone, Send, Trash2, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function BroadcastMessagesPanel({ institution }) {
  const [messages, setMessages] = useState([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    try {
      const list = institution?.id
        ? await backend.entities.MemberMessage.filter({ institution_id: institution.id }, "-created_date", 50)
        : await backend.entities.MemberMessage.list("-created_date", 50);
      setMessages(list || []);
    } catch {
      setMessages([]);
    }
  };

  useEffect(() => {
    load();
    let unsub;
    try { unsub = backend.entities.MemberMessage.subscribe(() => load()); } catch {}
    return () => { if (unsub) unsub(); };
  }, [institution?.id]);

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      toast({ title: "Add a title and a message before sending", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      await backend.entities.MemberMessage.create({
        institution_id: institution?.id || "",
        title: title.trim(),
        body: body.trim(),
        date: new Date().toISOString().slice(0, 10),
      });
      setTitle("");
      setBody("");
      toast({ title: "Message sent", description: "All members will see it in their portal." });
      load();
    } catch {
      toast({ title: "Could not send the message", variant: "destructive" });
    }
    setSending(false);
  };

  const remove = async (id) => {
    try {
      await backend.entities.MemberMessage.delete(id);
      load();
    } catch {
      toast({ title: "Could not delete the message", variant: "destructive" });
    }
  };

  return (
    <div className="mt-6 bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <Megaphone className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">Messages to Members</h3>
        <span className="ml-auto text-xs text-muted-foreground">Sent to all members' portals</span>
      </div>
      <div className="space-y-3 mb-5">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Message title (e.g. AGM Notice)"
          className="bg-transparent"
        />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message to all members..."
          rows={3}
          className="bg-transparent"
        />
        <Button onClick={send} disabled={sending} className="bg-amber-500 text-black hover:bg-amber-600">
          {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          {sending ? "Sending..." : "Send to All Members"}
        </Button>
      </div>
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-3">No messages sent yet.</p>
      ) : (
        <div className="divide-y divide-border">
          {messages.map((m) => (
            <div key={m.id} className="py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{m.title}</p>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {m.date ? new Date(m.date).toLocaleDateString() : ""}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{m.body}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(m.id)} title="Delete message"
                className="text-muted-foreground hover:text-destructive flex-shrink-0 h-8 w-8">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}