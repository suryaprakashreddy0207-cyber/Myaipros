import React, { useState } from "react";
import {
  X,
  Search,
  Upload,
  Check,
  Loader2,
  FileText,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import {
  GoogleDriveLogo,
  GoogleSheetsLogo,
  GmailLogo,
  SlackLogo,
} from "@/components/icons/app-logos";
import {
  connectGoogleWorkspace,
  getCachedGoogleToken,
  listGoogleDriveFiles,
  listGoogleSheets,
  listGmailMessages,
  getDriveFileTextSnippet,
  getGoogleSheetPreview,
  type GoogleDriveFileItem,
  type GoogleSheetItem,
  type GmailMessageItem,
} from "@/lib/google-auth";
import { addSourceToProject, type ProjectSource } from "@/lib/projects-store";
import { toast } from "sonner";

interface AddSourceModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSourceAdded: (source: ProjectSource) => void;
}

type TabType = "drive" | "sheets" | "gmail" | "file";

export function AddSourceModal({
  projectId,
  isOpen,
  onClose,
  onSourceAdded,
}: AddSourceModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("drive");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [token, setToken] = useState<string | null>(getCachedGoogleToken());

  // Data states
  const [driveFiles, setDriveFiles] = useState<GoogleDriveFileItem[]>([]);
  const [sheetsList, setSheetsList] = useState<GoogleSheetItem[]>([]);
  const [gmailList, setGmailList] = useState<GmailMessageItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addingSources, setAddingSources] = useState(false);

  // File upload state
  const [uploadFileName, setUploadFileName] = useState("");
  const [uploadFileContent, setUploadFileContent] = useState("");

  if (!isOpen) return null;

  async function handleGoogleConnect() {
    setIsConnecting(true);
    try {
      const res = await connectGoogleWorkspace();
      setToken(res.accessToken);
      toast.success("Connected to Google Workspace!");
      loadItemsForTab(activeTab, res.accessToken);
    } catch (err: any) {
      toast.error(err.message || "Google sign-in was canceled or failed.");
    } finally {
      setIsConnecting(false);
    }
  }

  async function loadItemsForTab(tab: TabType, currentToken?: string | null) {
    const activeTok = currentToken || token || getCachedGoogleToken();
    if (!activeTok) return;

    setIsLoadingItems(true);
    try {
      if (tab === "drive") {
        const files = await listGoogleDriveFiles(activeTok, searchQuery);
        setDriveFiles(files);
      } else if (tab === "sheets") {
        const sheets = await listGoogleSheets(activeTok, searchQuery);
        setSheetsList(sheets);
      } else if (tab === "gmail") {
        const msgs = await listGmailMessages(activeTok, searchQuery);
        setGmailList(msgs);
      }
    } catch (err: any) {
      console.warn("Failed to load Google Workspace items:", err);
      toast.error(err.message || "Failed to load items. You may need to reconnect.");
    } finally {
      setIsLoadingItems(false);
    }
  }

  function handleTabChange(tab: TabType) {
    setActiveTab(tab);
    setSelectedIds(new Set());
    if (tab !== "file") {
      loadItemsForTab(tab);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAddSelected() {
    setAddingSources(true);
    const activeTok = token || getCachedGoogleToken();

    try {
      if (activeTab === "drive") {
        const toAdd = driveFiles.filter((f) => selectedIds.has(f.id));
        for (const file of toAdd) {
          let snippet = "";
          if (activeTok) {
            snippet = await getDriveFileTextSnippet(activeTok, file.id, file.mimeType);
          }
          const added = await addSourceToProject(projectId, {
            type: "drive",
            title: file.name,
            mimeType: file.mimeType,
            size: file.size ? `${Math.round(parseInt(file.size) / 1024)} KB` : undefined,
            link: file.webViewLink,
            snippet: snippet || `Google Drive document: ${file.name}`,
          });
          onSourceAdded(added);
        }
        toast.success(`Added ${toAdd.length} Drive document(s) to project sources`);
      } else if (activeTab === "sheets") {
        const toAdd = sheetsList.filter((s) => selectedIds.has(s.id));
        for (const sheet of toAdd) {
          let snippet = "";
          if (activeTok) {
            try {
              const preview = await getGoogleSheetPreview(activeTok, sheet.id);
              snippet = `Google Sheet: ${preview.title}\nTabs: ${preview.sheetNames.join(", ")}\nSample data:\n${preview.sampleValues
                .slice(0, 5)
                .map((row) => row.join(" | "))
                .join("\n")}`;
            } catch {
              snippet = `Google Sheet: ${sheet.name}`;
            }
          }
          const added = await addSourceToProject(projectId, {
            type: "sheet",
            title: sheet.name,
            link: sheet.webViewLink,
            snippet: snippet || `Google Spreadsheet: ${sheet.name}`,
          });
          onSourceAdded(added);
        }
        toast.success(`Added ${toAdd.length} Google Sheet(s) to project sources`);
      } else if (activeTab === "gmail") {
        const toAdd = gmailList.filter((m) => selectedIds.has(m.id));
        for (const msg of toAdd) {
          const added = await addSourceToProject(projectId, {
            type: "gmail",
            title: msg.subject,
            snippet: `From: ${msg.from}\nDate: ${msg.date}\nSnippet: ${msg.snippet}`,
          });
          onSourceAdded(added);
        }
        toast.success(`Added ${toAdd.length} Gmail thread(s) to project sources`);
      } else if (activeTab === "file") {
        if (!uploadFileName || !uploadFileContent) {
          toast.error("Please select or paste file content");
          return;
        }
        const added = await addSourceToProject(projectId, {
          type: "file",
          title: uploadFileName,
          snippet: uploadFileContent.slice(0, 3000),
          size: `${Math.round(uploadFileContent.length / 1024)} KB`,
        });
        onSourceAdded(added);
        toast.success("File added to project sources");
      }

      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to add sources");
    } finally {
      setAddingSources(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setUploadFileContent(reader.result as string);
    };
    reader.readAsText(file);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex h-[90vh] max-h-[640px] w-full max-w-xl flex-col rounded-3xl bg-[#141415] border border-neutral-800 text-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800/80 px-6 py-4">
          <div>
            <h3 className="font-semibold text-base text-white">Add Sources to Project</h3>
            <p className="text-xs text-neutral-400">
              Connect Google Drive, Sheets, Gmail or upload local documents
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Integration Source Tabs */}
        <div className="grid grid-cols-4 border-b border-neutral-800/80 bg-neutral-900/60 p-2 gap-1.5">
          <button
            onClick={() => handleTabChange("drive")}
            className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl py-2.5 px-2 text-xs font-medium transition ${
              activeTab === "drive"
                ? "bg-neutral-800 text-white shadow-sm ring-1 ring-neutral-700"
                : "text-neutral-400 hover:bg-neutral-800/40 hover:text-neutral-200"
            }`}
          >
            <GoogleDriveLogo className="size-5" />
            <span>Google Drive</span>
          </button>

          <button
            onClick={() => handleTabChange("sheets")}
            className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl py-2.5 px-2 text-xs font-medium transition ${
              activeTab === "sheets"
                ? "bg-neutral-800 text-white shadow-sm ring-1 ring-neutral-700"
                : "text-neutral-400 hover:bg-neutral-800/40 hover:text-neutral-200"
            }`}
          >
            <GoogleSheetsLogo className="size-5" />
            <span>Google Sheets</span>
          </button>

          <button
            onClick={() => handleTabChange("gmail")}
            className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl py-2.5 px-2 text-xs font-medium transition ${
              activeTab === "gmail"
                ? "bg-neutral-800 text-white shadow-sm ring-1 ring-neutral-700"
                : "text-neutral-400 hover:bg-neutral-800/40 hover:text-neutral-200"
            }`}
          >
            <GmailLogo className="size-5" />
            <span>Gmail</span>
          </button>

          <button
            onClick={() => handleTabChange("file")}
            className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl py-2.5 px-2 text-xs font-medium transition ${
              activeTab === "file"
                ? "bg-neutral-800 text-white shadow-sm ring-1 ring-neutral-700"
                : "text-neutral-400 hover:bg-neutral-800/40 hover:text-neutral-200"
            }`}
          >
            <Upload className="size-5 text-neutral-300" />
            <span>Upload File</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab !== "file" && !token ? (
            /* Google OAuth Connect Callout */
            <div className="flex h-full flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="flex items-center gap-2">
                <GoogleDriveLogo className="size-8" />
                <GoogleSheetsLogo className="size-8" />
                <GmailLogo className="size-8" />
              </div>
              <h4 className="text-lg font-medium text-white">
                Connect your Google Account
              </h4>
              <p className="max-w-md text-xs text-neutral-400 leading-relaxed">
                Authorize Google Workspace to browse and select your Google Drive files,
                Sheets spreadsheets, and Gmail messages to give My AI direct context.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  onClick={handleGoogleConnect}
                  disabled={isConnecting}
                  className="flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black hover:bg-neutral-100 transition shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="size-4 animate-spin text-black" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <GoogleDriveLogo className="size-4" />
                      Sign in with Google
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    const sampleToken = "workspace-active-token";
                    setToken(sampleToken);
                    toast.success("Connected to Google Workspace!");
                    loadItemsForTab(activeTab, sampleToken);
                  }}
                  className="rounded-full border border-neutral-700 bg-neutral-800/80 px-5 py-2.5 text-xs font-medium text-neutral-300 hover:bg-neutral-700 hover:text-white transition"
                >
                  Connect with Sample Workspace
                </button>
              </div>
            </div>
          ) : activeTab === "file" ? (
            /* File Upload Form */
            <div className="space-y-4">
              <div className="rounded-2xl border-2 border-dashed border-neutral-700 p-8 text-center hover:border-neutral-500 transition">
                <Upload className="mx-auto size-8 text-neutral-400 mb-2" />
                <p className="text-sm font-medium text-white mb-1">
                  Upload a document, PDF, CSV, or code file
                </p>
                <p className="text-xs text-neutral-400 mb-4">
                  Text will be extracted and made available to My AI
                </p>
                <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-neutral-800 px-5 py-2 text-xs font-semibold text-white hover:bg-neutral-700 transition">
                  Browse file
                  <input
                    type="file"
                    accept=".txt,.md,.json,.csv,.pdf,.py,.ts,.tsx,.js"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
                {uploadFileName && (
                  <p className="mt-3 text-xs text-emerald-400 font-medium">
                    ✓ Selected: {uploadFileName} ({Math.round(uploadFileContent.length / 1024)} KB)
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  Or paste text directly
                </label>
                <textarea
                  rows={4}
                  value={uploadFileContent}
                  onChange={(e) => {
                    setUploadFileContent(e.target.value);
                    if (!uploadFileName) setUploadFileName("Pasted-Notes.txt");
                  }}
                  placeholder="Paste research, meeting notes, project specs, or spreadsheet rows here…"
                  className="w-full rounded-2xl bg-neutral-900 border border-neutral-800 p-3 text-xs text-white placeholder:text-neutral-500 focus:border-neutral-600 focus:outline-none"
                />
              </div>
            </div>
          ) : (
            /* Google Items List (Drive / Sheets / Gmail) */
            <div className="space-y-3">
              {/* Search & Refresh */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 size-4 text-neutral-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loadItemsForTab(activeTab)}
                    placeholder={`Search ${
                      activeTab === "drive"
                        ? "Google Drive files..."
                        : activeTab === "sheets"
                        ? "Google Sheets..."
                        : "Gmail messages..."
                    }`}
                    className="w-full rounded-full bg-neutral-900 border border-neutral-800 py-2 pl-9 pr-4 text-xs text-white placeholder:text-neutral-500 focus:border-neutral-600 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => loadItemsForTab(activeTab)}
                  disabled={isLoadingItems}
                  className="rounded-full bg-neutral-800 px-3.5 py-2 text-xs font-medium text-neutral-200 hover:bg-neutral-700 transition disabled:opacity-50"
                >
                  {isLoadingItems ? <Loader2 className="size-3.5 animate-spin" /> : "Refresh"}
                </button>
              </div>

              {/* Items List */}
              {isLoadingItems ? (
                <div className="py-16 text-center text-xs text-neutral-400 flex flex-col items-center gap-2">
                  <Loader2 className="size-6 animate-spin text-neutral-400" />
                  <span>Loading from Google Workspace…</span>
                </div>
              ) : activeTab === "drive" ? (
                driveFiles.length === 0 ? (
                  <div className="py-12 text-center text-xs text-neutral-500">
                    No files found in Google Drive. Try searching or create files in Drive.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {driveFiles.map((file) => {
                      const selected = selectedIds.has(file.id);
                      return (
                        <div
                          key={file.id}
                          onClick={() => toggleSelect(file.id)}
                          className={`flex cursor-pointer items-center justify-between rounded-2xl p-3 border transition ${
                            selected
                              ? "bg-neutral-800/90 border-neutral-600"
                              : "bg-neutral-900/70 border-neutral-800/60 hover:bg-neutral-800/40"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <GoogleDriveLogo className="size-5 shrink-0" />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-white">
                                {file.name}
                              </p>
                              <p className="text-[10px] text-neutral-400 truncate">
                                {file.mimeType.replace("application/vnd.google-apps.", "")}
                              </p>
                            </div>
                          </div>
                          <div
                            className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition ${
                              selected
                                ? "bg-white border-white text-black"
                                : "border-neutral-600 bg-neutral-800"
                            }`}
                          >
                            {selected && <Check className="size-3 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : activeTab === "sheets" ? (
                sheetsList.length === 0 ? (
                  <div className="py-12 text-center text-xs text-neutral-500">
                    No Google Spreadsheets found.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {sheetsList.map((sheet) => {
                      const selected = selectedIds.has(sheet.id);
                      return (
                        <div
                          key={sheet.id}
                          onClick={() => toggleSelect(sheet.id)}
                          className={`flex cursor-pointer items-center justify-between rounded-2xl p-3 border transition ${
                            selected
                              ? "bg-neutral-800/90 border-neutral-600"
                              : "bg-neutral-900/70 border-neutral-800/60 hover:bg-neutral-800/40"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <GoogleSheetsLogo className="size-5 shrink-0" />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-white">
                                {sheet.name}
                              </p>
                              <p className="text-[10px] text-neutral-400">Spreadsheet</p>
                            </div>
                          </div>
                          <div
                            className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition ${
                              selected
                                ? "bg-white border-white text-black"
                                : "border-neutral-600 bg-neutral-800"
                            }`}
                          >
                            {selected && <Check className="size-3 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : activeTab === "gmail" ? (
                gmailList.length === 0 ? (
                  <div className="py-12 text-center text-xs text-neutral-500">
                    No Gmail messages found matching search.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {gmailList.map((msg) => {
                      const selected = selectedIds.has(msg.id);
                      return (
                        <div
                          key={msg.id}
                          onClick={() => toggleSelect(msg.id)}
                          className={`flex cursor-pointer items-center justify-between rounded-2xl p-3 border transition ${
                            selected
                              ? "bg-neutral-800/90 border-neutral-600"
                              : "bg-neutral-900/70 border-neutral-800/60 hover:bg-neutral-800/40"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <GmailLogo className="size-5 shrink-0" />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-white">
                                {msg.subject}
                              </p>
                              <p className="text-[10px] text-neutral-400 truncate">
                                From: {msg.from} • {msg.snippet}
                              </p>
                            </div>
                          </div>
                          <div
                            className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition ${
                              selected
                                ? "bg-white border-white text-black"
                                : "border-neutral-600 bg-neutral-800"
                            }`}
                          >
                            {selected && <Check className="size-3 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : null}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-neutral-800/80 px-6 py-4 bg-neutral-900/40">
          <button
            onClick={onClose}
            className="rounded-full px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white transition"
          >
            Cancel
          </button>

          <button
            onClick={handleAddSelected}
            disabled={
              addingSources ||
              (activeTab === "file" ? !uploadFileContent : selectedIds.size === 0)
            }
            className="flex items-center gap-2 rounded-full bg-white px-5 py-2 text-xs font-semibold text-black hover:bg-neutral-200 transition shadow disabled:opacity-40 active:scale-95"
          >
            {addingSources ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Adding Sources...
              </>
            ) : (
              <>
                Add {activeTab === "file" ? "File" : `${selectedIds.size} Selected`}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
