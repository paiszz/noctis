"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale/id";
import {
  Plus,
  StickyNote,
  Search,
  Star,
  StarOff,
  Trash2,
  Tag as TagIcon,
  Folder,
} from "lucide-react";
import { Card, Badge, Button, EmptyState, Modal } from "@/components/ui";
import { useData } from "@/lib/data-context";
import { toJakartaDate } from "@/lib/date";
import type { Note } from "@/types";
import { NoteEditorModal } from "./NoteEditorModal";
import { toast } from "sonner";

export function NotesView() {
  const { notes, toggleNoteFavorite, deleteNote } = useData();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Modal states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

  // Dynamic unique categories from all notes
  const categories = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => {
      if (n.category?.trim()) set.add(n.category.trim());
    });
    return Array.from(set).sort();
  }, [notes]);

  const filteredNotes = useMemo(() => {
    let list = [...notes];

    // Search query matches title, content, or tags
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Category filter
    if (activeCategory) {
      list = list.filter((n) => n.category === activeCategory);
    }

    // Favorites filter
    if (showFavoritesOnly) {
      list = list.filter((n) => n.is_favorite);
    }

    // Sort: favorites first, then by updated_at descending
    list.sort((a, b) => {
      if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    return list;
  }, [notes, searchQuery, activeCategory, showFavoritesOnly]);

  const handleOpenCreate = () => {
    setEditingNote(null);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (note: Note) => {
    setEditingNote(note);
    setIsEditorOpen(true);
  };

  const confirmDelete = () => {
    if (noteToDelete) {
      deleteNote(noteToDelete.id);
      toast.success(`Catatan "${noteToDelete.title}" telah dihapus.`);
      setNoteToDelete(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Catatan
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {notes.length} catatan tersimpan •{" "}
            {notes.filter((n) => n.is_favorite).length} favorit
          </p>
        </div>
        <Button
          size="sm"
          icon={<Plus className="w-4 h-4" />}
          onClick={handleOpenCreate}
        >
          Catatan Baru
        </Button>
      </div>

      {/* Search & Favorites Toggle */}
      <div className="flex gap-2.5 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Cari catatan berdasarkan judul, isi, atau tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-surface border border-border/80 rounded-xl
              text-foreground placeholder:text-muted shadow-sm
              focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus"
          />
        </div>
        <Button
          variant={showFavoritesOnly ? "primary" : "outline"}
          size="sm"
          onClick={() => setShowFavoritesOnly((v) => !v)}
          icon={
            showFavoritesOnly ? (
              <Star className="w-4 h-4 fill-white text-white" />
            ) : (
              <StarOff className="w-4 h-4 text-muted" />
            )
          }
          className="shrink-0"
        >
          Favorit
        </Button>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-all cursor-pointer ${
            !activeCategory
              ? "bg-primary text-white shadow-sm font-bold"
              : "bg-surface text-muted hover:bg-soft-accent hover:text-foreground border border-border/60"
          }`}
        >
          Semua
        </button>
        {categories.map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory((c) => (c === cat ? null : cat))}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? "bg-primary text-white shadow-sm font-bold"
                  : "bg-surface text-muted hover:bg-soft-accent hover:text-foreground border border-border/60"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Notes Grid */}
      {filteredNotes.length === 0 ? (
        <Card>
          <EmptyState
            icon={StickyNote}
            title={
              searchQuery || activeCategory || showFavoritesOnly
                ? "Catatan tidak ditemukan"
                : "Belum ada catatan"
            }
            description={
              searchQuery || activeCategory || showFavoritesOnly
                ? "Tidak ada catatan yang cocok dengan filter atau kata kunci pencarian."
                : "Mulai catat materi kuliah, rangkuman, ide, atau apapun yang penting bagimu."
            }
            action={
              !searchQuery && !activeCategory && !showFavoritesOnly ? (
                <Button
                  size="sm"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={handleOpenCreate}
                >
                  Catatan Baru
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setActiveCategory(null);
                    setShowFavoritesOnly(false);
                  }}
                >
                  Reset Filter
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
          {filteredNotes.map((note) => (
            <Card
              key={note.id}
              hover
              padding="md"
              className="group flex flex-col justify-between transition-all"
            >
              {/* Card top */}
              <div
                onClick={() => handleOpenEdit(note)}
                className="cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2.5 mb-2">
                  <h2 className="font-bold text-sm sm:text-base text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                    {note.title}
                  </h2>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleNoteFavorite(note.id);
                      toast.success(
                        note.is_favorite
                          ? `Catatan "${note.title}" dihapus dari favorit.`
                          : `Catatan "${note.title}" ditambahkan ke favorit.`
                      );
                    }}
                    className="shrink-0 p-1 rounded-lg text-muted hover:text-warning hover:bg-warning-light/50 transition-colors cursor-pointer"
                    aria-label={
                      note.is_favorite
                        ? "Hapus dari favorit"
                        : "Tambah ke favorit"
                    }
                  >
                    <Star
                      className={`w-4 h-4 transition-transform group-hover:scale-105 ${
                        note.is_favorite
                          ? "fill-warning text-warning"
                          : "text-muted/60"
                      }`}
                    />
                  </button>
                </div>

                <p className="text-xs text-muted-dark line-clamp-3 leading-relaxed mb-3 font-normal">
                  {note.content.replace(/[#*\-\n]/g, " ").trim()}
                </p>
              </div>

              {/* Card Bottom: Category, Tags, Date, and Delete button */}
              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  {note.category && (
                    <Badge variant="default" className="text-[11px] py-0 px-2">
                      {note.category}
                    </Badge>
                  )}
                  {note.tags && note.tags.length > 0 && (
                    <span className="text-[10px] text-muted-dark truncate max-w-[120px]">
                      #{note.tags[0]}
                      {note.tags.length > 1 && ` +${note.tags.length - 1}`}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-muted">
                    {format(toJakartaDate(note.updated_at), "dd MMM yyyy", {
                      locale: localeId,
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setNoteToDelete(note)}
                    className="p-1 rounded-md text-muted hover:text-danger hover:bg-danger-light opacity-60 group-hover:opacity-100 transition-all cursor-pointer"
                    aria-label={`Hapus catatan ${note.title}`}
                    title="Hapus catatan"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Note Create/Edit Modal */}
      <NoteEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        noteToEdit={editingNote}
        onDelete={(n) => setNoteToDelete(n)}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(noteToDelete)}
        onClose={() => setNoteToDelete(null)}
        title="Hapus Catatan"
        description="Apakah kamu yakin ingin menghapus catatan ini? Catatan yang dihapus tidak dapat dipulihkan."
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-surface-muted rounded-xl border border-border/80">
            <p className="text-sm font-semibold text-foreground">
              {noteToDelete?.title}
            </p>
          </div>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNoteToDelete(null)}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={confirmDelete}
            >
              Hapus Catatan
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
