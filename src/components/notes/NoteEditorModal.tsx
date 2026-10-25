"use client";

import React, { useState } from "react";
import { Modal, Button } from "@/components/ui";
import { useData } from "@/lib/data-context";
import type { Note } from "@/types";
import { Star, Trash2, Tag as TagIcon, Folder } from "lucide-react";
import { toast } from "sonner";

interface NoteEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteToEdit?: Note | null;
  onDelete?: (note: Note) => void;
}

const DEFAULT_CATEGORIES = ["Kuliah", "Personal", "Karir", "Riset"];

export function NoteEditorModal({
  isOpen,
  onClose,
  noteToEdit,
  onDelete,
}: NoteEditorModalProps) {
  const { addNote, updateNote } = useData();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const initialCat = noteToEdit?.category || "Kuliah";
  const initialIsDefault = DEFAULT_CATEGORIES.includes(initialCat);

  const [title, setTitle] = useState(() => noteToEdit?.title || "");
  const [content, setContent] = useState(() => noteToEdit?.content || "");
  const [category, setCategory] = useState(() => (initialIsDefault ? initialCat : "custom"));
  const [customCategory, setCustomCategory] = useState(() => (initialIsDefault ? "" : initialCat));
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(() => noteToEdit?.tags || []);
  const [isFavorite, setIsFavorite] = useState(() => Boolean(noteToEdit?.is_favorite));
  const [errors, setErrors] = useState<{ title?: string; content?: string }>({});

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevNoteToEdit, setPrevNoteToEdit] = useState(noteToEdit);

  // Synchronize form when modal opens or noteToEdit changes
  if (isOpen !== prevIsOpen || noteToEdit !== prevNoteToEdit) {
    setPrevIsOpen(isOpen);
    setPrevNoteToEdit(noteToEdit);
    if (isOpen) {
      if (noteToEdit) {
        setTitle(noteToEdit.title);
        setContent(noteToEdit.content);
        const cat = noteToEdit.category || "Kuliah";
        if (DEFAULT_CATEGORIES.includes(cat)) {
          setCategory(cat);
          setCustomCategory("");
        } else {
          setCategory("custom");
          setCustomCategory(cat);
        }
        setTags(noteToEdit.tags || []);
        setTagInput("");
        setIsFavorite(noteToEdit.is_favorite);
      } else {
        setTitle("");
        setContent("");
        setCategory("Kuliah");
        setCustomCategory("");
        setTags([]);
        setTagInput("");
        setIsFavorite(false);
      }
      setErrors({});
    }
  }

  const handleAddTag = () => {
    const trimmed = tagInput.trim().replace(/^#/, "");
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors: { title?: string; content?: string } = {};
    if (!title.trim()) {
      validationErrors.title = "Judul catatan wajib diisi.";
    }
    if (!content.trim()) {
      validationErrors.content = "Isi catatan tidak boleh kosong.";
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const finalCategory =
      category === "custom"
        ? customCategory.trim() || undefined
        : category.trim() || undefined;

    // Check if tagInput has unsaved tag
    const finalTags = [...tags];
    const pendingTag = tagInput.trim().replace(/^#/, "");
    if (pendingTag && !finalTags.includes(pendingTag)) {
      finalTags.push(pendingTag);
    }

    try {
      setIsSubmitting(true);
      if (noteToEdit) {
        await updateNote(noteToEdit.id, {
          title,
          content,
          category: finalCategory,
          tags: finalTags.length > 0 ? finalTags : undefined,
          is_favorite: isFavorite,
        });
        toast.success("Catatan berhasil diperbarui");
      } else {
        await addNote({
          title,
          content,
          category: finalCategory,
          tags: finalTags.length > 0 ? finalTags : undefined,
          is_favorite: isFavorite,
        });
        toast.success("Catatan baru berhasil dibuat");
      }
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Gagal menyimpan catatan. Silakan periksa koneksi internet.";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={noteToEdit ? "Edit Catatan" : "Catatan Baru"}
      description={
        noteToEdit
          ? "Ubah isi materi, ide, atau kategori catatan."
          : "Catat materi kuliah, ringkasan, atau referensi penting."
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title & Favorite Toggle */}
        <div className="flex items-start gap-2.5">
          <div className="flex-1">
            <input
              type="text"
              required
              placeholder="Judul catatan..."
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
              }}
              className="w-full text-base sm:text-lg font-bold px-3 py-2 bg-surface-muted border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:border-border-focus"
            />
            {errors.title && (
              <p className="text-xs text-danger mt-1">{errors.title}</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsFavorite((prev) => !prev)}
            className={`p-2.5 rounded-xl border transition-colors cursor-pointer shrink-0 ${
              isFavorite
                ? "bg-warning-light border-warning/40 text-warning"
                : "border-border text-muted hover:text-warning hover:border-warning/40"
            }`}
            aria-label={isFavorite ? "Hapus dari favorit" : "Tandai sebagai favorit"}
            title={isFavorite ? "Favorit" : "Tandai favorit"}
          >
            <Star className={`w-5 h-5 ${isFavorite ? "fill-warning" : ""}`} />
          </button>
        </div>

        {/* Category & Tags Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-surface-muted rounded-2xl border border-border/70">
          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-dark flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-primary" />
              <span>Kategori</span>
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {DEFAULT_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                    category === cat
                      ? "bg-primary text-white font-semibold"
                      : "bg-surface border border-border/80 text-muted-dark hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCategory("custom")}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                  category === "custom"
                    ? "bg-primary text-white font-semibold"
                    : "bg-surface border border-border/80 text-muted-dark hover:text-foreground"
                }`}
              >
                Lainnya...
              </button>
            </div>
            {category === "custom" && (
              <input
                type="text"
                placeholder="Masukkan kategori baru..."
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="w-full mt-2 px-3 py-1.5 text-xs bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:border-border-focus"
              />
            )}
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-dark flex items-center gap-1.5">
              <TagIcon className="w-3.5 h-3.5 text-primary" />
              <span>Tag (opsional)</span>
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Tambah tag lalu Enter..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                className="flex-1 px-3 py-1.5 text-xs bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:border-border-focus"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddTag}
                className="text-xs px-2.5 py-1 rounded-lg"
              >
                Tambah
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white text-[11px] font-medium border border-border text-muted-dark"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-muted hover:text-danger ml-0.5 cursor-pointer font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content Editor */}
        <div>
          <label
            htmlFor="note-content"
            className="block text-xs font-semibold text-foreground mb-1"
          >
            Isi Catatan <span className="text-danger">*</span>
          </label>
          <textarea
            id="note-content"
            rows={10}
            required
            placeholder="Tulis materi, ringkasan, atau catatanmu di sini..."
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (errors.content) setErrors((prev) => ({ ...prev, content: undefined }));
            }}
            className="w-full p-3.5 text-sm bg-surface-muted border border-border rounded-2xl text-foreground placeholder:text-muted focus:outline-none focus:border-border-focus leading-relaxed font-mono resize-y"
          />
          {errors.content && (
            <p className="text-xs text-danger mt-1">{errors.content}</p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border/60">
          <div>
            {noteToEdit && onDelete && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={isSubmitting}
                icon={<Trash2 className="w-4 h-4" />}
                onClick={() => {
                  onDelete(noteToEdit);
                  onClose();
                }}
              >
                Hapus
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isSubmitting}
              onClick={onClose}
            >
              Batal
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting
                ? "Menyimpan..."
                : noteToEdit
                ? "Simpan Perubahan"
                : "Simpan Catatan"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
