import React, { useState } from "react";
import { X, Settings, Trash2, Check, Loader2 } from "lucide-react";
import { updateProject, deleteProject, type ProjectItem } from "@/lib/projects-store";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

interface ProjectSettingsModalProps {
  project: ProjectItem;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (updated: ProjectItem) => void;
}

export function ProjectSettingsModal({
  project,
  isOpen,
  onClose,
  onUpdated,
}: ProjectSettingsModalProps) {
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description || "");
  const [instructions, setInstructions] = useState(project.instructions || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  if (!isOpen) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      const updates = {
        title: title.trim(),
        description: description.trim(),
        instructions: instructions.trim(),
      };
      await updateProject(project.id, updates);
      onUpdated({ ...project, ...updates });
      toast.success("Project settings saved");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to update project");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Are you sure you want to delete "${project.title}"? This cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteProject(project.id);
      toast.success("Project deleted");
      onClose();
      navigate({ to: "/projects" });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete project");
      setIsDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex w-full max-w-lg flex-col rounded-3xl bg-[#141415] border border-neutral-800 text-white shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800/80">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-2xl bg-neutral-800 text-neutral-200">
              <Settings className="size-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">Project Settings</h3>
              <p className="text-xs text-neutral-400">Configure instructions and details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">
              Project Name
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-2xl bg-neutral-900 border border-neutral-800 p-2.5 text-xs text-white focus:border-neutral-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              className="w-full rounded-2xl bg-neutral-900 border border-neutral-800 p-2.5 text-xs text-white placeholder:text-neutral-500 focus:border-neutral-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">
              Custom Instructions for My AI
            </label>
            <textarea
              rows={4}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Provide specific guidelines, rules, tone, or context for My AI when chatting inside this project..."
              className="w-full rounded-2xl bg-neutral-900 border border-neutral-800 p-3 text-xs text-white placeholder:text-neutral-500 focus:border-neutral-600 focus:outline-none"
            />
            <p className="text-[10px] text-neutral-500 mt-1">
              My AI will follow these instructions during every conversation in this project.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-neutral-800/80">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition"
            >
              <Trash2 className="size-3.5" />
              <span>{isDeleting ? "Deleting..." : "Delete Project"}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-4 py-1.5 text-xs font-medium text-neutral-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || !title.trim()}
                className="flex items-center gap-1.5 rounded-full bg-white px-5 py-2 text-xs font-semibold text-black hover:bg-neutral-200 transition active:scale-95 disabled:opacity-40"
              >
                {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                <span>Save</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
