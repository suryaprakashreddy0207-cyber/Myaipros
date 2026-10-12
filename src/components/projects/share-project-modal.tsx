import React, { useState } from "react";
import { X, Copy, Check, Users, Share2, Mail, Loader2 } from "lucide-react";
import { shareProjectWithEmail, type ProjectItem } from "@/lib/projects-store";
import { toast } from "sonner";

interface ShareProjectModalProps {
  project: ProjectItem;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export function ShareProjectModal({
  project,
  isOpen,
  onClose,
  onUpdated,
}: ShareProjectModalProps) {
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  if (!isOpen) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = `${origin}/projects/${project.id}?shared=true`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Project link copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Failed to copy link");
    }
  }

  async function handleShareEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSharing(true);
    try {
      await shareProjectWithEmail(project.id, email.trim());
      toast.success(`Project shared with ${email.trim()}!`);
      setEmail("");
      onUpdated?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to share project");
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex w-full max-w-md flex-col rounded-3xl bg-[#141415] border border-neutral-800 text-white shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800/80">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-2xl bg-neutral-800 text-neutral-200">
              <Share2 className="size-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">Share Project</h3>
              <p className="text-xs text-neutral-400 truncate max-w-[240px]">
                {project.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="py-5 space-y-4">
          {/* Share Link Box */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">
              Project Link
            </label>
            <div className="flex items-center gap-2 rounded-2xl bg-neutral-900 border border-neutral-800 p-1.5 pl-3">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-transparent text-xs text-neutral-300 outline-none select-all truncate"
              />
              <button
                onClick={handleCopy}
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-neutral-200 transition active:scale-95"
              >
                {copied ? (
                  <>
                    <Check className="size-3.5 stroke-[3]" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" /> Copy
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Share with friend email */}
          <form onSubmit={handleShareEmail}>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">
              Invite friends by email
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-2.5 size-3.5 text-neutral-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="friend@example.com"
                  className="w-full rounded-2xl bg-neutral-900 border border-neutral-800 py-2 pl-8 pr-3 text-xs text-white placeholder:text-neutral-500 focus:border-neutral-600 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={isSharing || !email.trim()}
                className="rounded-2xl bg-neutral-800 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-700 transition disabled:opacity-40"
              >
                {isSharing ? <Loader2 className="size-3.5 animate-spin" /> : "Invite"}
              </button>
            </div>
          </form>

          {/* Collaborators list */}
          {project.sharedWith && project.sharedWith.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Users className="size-3" /> Shared with:
              </p>
              <div className="space-y-1">
                {project.sharedWith.map((em, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl bg-neutral-900/60 px-3 py-1.5 text-xs text-neutral-300"
                  >
                    <span>{em}</span>
                    <span className="text-[10px] text-neutral-500">Collaborator</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-neutral-800/80 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-full bg-neutral-800 px-4 py-1.5 text-xs font-medium text-neutral-200 hover:text-white transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
