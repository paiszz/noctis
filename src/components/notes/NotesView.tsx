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
} from "lucide-react";
import { Card, Badge, Button, EmptyState } from "@/components/ui";
import { mockNotes, getMockNoteCategories } from "@/lib/mock-data";
import { toJakartaDate } from "@/lib/date";

export function NotesView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const categories = useMemo(() => getMockNoteCategories(), []);

  const filteredNotes = useMemo(() => {
    let notes = [...mockNotes];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      notes = notes.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q)
      );
    }

    if (activeCategory) {
      notes = notes.filter((n) => n.category === activeCategory);
    }

    if (showFavoritesOnly) {
      notes = notes.filter((n) => n.is_favorite);
    }

    // Sort: favorites first, then by updated_at
    notes.sort((a, b) => {
      if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    return notes;
  }, [searchQuery, activeCategory, showFavoritesOnly]);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Catatan</h2>
          <p className="text-sm text-muted">{mockNotes.length} catatan</p>
        </div>
        <Button size="sm" icon={<Plus className="w-4 h-4" />}>
          Catatan Baru
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Cari catatan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-surface border border-border rounded-lg
              text-foreground placeholder:text-muted
              focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus"
          />
        </div>
        <Button
          variant={showFavoritesOnly ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setShowFavoritesOnly((v) => !v)}
          icon={
            showFavoritesOnly ? (
              <Star className="w-4 h-4 fill-current" />
            ) : (
              <StarOff className="w-4 h-4" />
            )
          }
        >
          Favorit
        </Button>
      </div>

      {/* Category filter */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
            !activeCategory
              ? "bg-primary text-white"
              : "text-muted hover:bg-soft-accent hover:text-foreground"
          }`}
        >
          Semua
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() =>
              setActiveCategory((c) => (c === cat ? null : cat))
            }
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeCategory === cat
                ? "bg-primary text-white"
                : "text-muted hover:bg-soft-accent hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Notes list */}
      {filteredNotes.length === 0 ? (
        <Card>
          <EmptyState
            icon={StickyNote}
            title={searchQuery ? "Tidak ditemukan" : "Belum ada catatan"}
            description={
              searchQuery
                ? `Tidak ada catatan yang cocok dengan "${searchQuery}".`
                : "Mulai catat ide, materi kuliah, atau apapun yang penting."
            }
            action={
              !searchQuery && (
                <Button size="sm" icon={<Plus className="w-4 h-4" />}>
                  Catatan Baru
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredNotes.map((note) => (
            <Card key={note.id} hover>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-medium text-sm text-foreground line-clamp-1">
                  {note.title}
                </h3>
                <button
                  className="shrink-0 text-muted hover:text-warning transition-colors"
                  aria-label={
                    note.is_favorite
                      ? "Hapus dari favorit"
                      : "Tambah ke favorit"
                  }
                >
                  <Star
                    className={`w-4 h-4 ${
                      note.is_favorite
                        ? "fill-warning text-warning"
                        : ""
                    }`}
                  />
                </button>
              </div>
              <p className="text-xs text-muted line-clamp-3 mb-3">
                {note.content.replace(/[#*\-\n]/g, " ").trim()}
              </p>
              <div className="flex items-center justify-between">
                {note.category && (
                  <Badge variant="default">{note.category}</Badge>
                )}
                <span className="text-[10px] text-muted">
                  {format(toJakartaDate(note.updated_at), "dd MMM yyyy", {
                    locale: localeId,
                  })}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
