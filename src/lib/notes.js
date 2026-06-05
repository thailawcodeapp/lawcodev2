// Notes persistence — localStorage-backed
import { markDirty } from '../services/sync/dirty';

const STORAGE_KEY = 'lawcode-th-notes';

function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function getNotesForSection(sectionId) {
  const all = loadAll();
  return all[sectionId] || [];
}

export function getAllNotes() {
  return loadAll();
}

export function addNote(sectionId, text, highlightId = null) {
  const all = loadAll();
  if (!all[sectionId]) all[sectionId] = [];
  const note = {
    id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    text,
    highlightId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  all[sectionId].push(note);
  saveAll(all);
  markDirty('notes');
  return note;
}

export function updateNote(sectionId, noteId, newText) {
  const all = loadAll();
  const notes = all[sectionId] || [];
  const idx = notes.findIndex(n => n.id === noteId);
  if (idx >= 0) {
    notes[idx] = { ...notes[idx], text: newText, updatedAt: Date.now() };
    saveAll(all);
    markDirty('notes');
    return notes[idx];
  }
  return null;
}

export function deleteNote(sectionId, noteId) {
  const all = loadAll();
  const notes = all[sectionId] || [];
  all[sectionId] = notes.filter(n => n.id !== noteId);
  if (all[sectionId].length === 0) delete all[sectionId];
  saveAll(all);
  markDirty('notes');
}

export function countNotes() {
  const all = loadAll();
  return Object.values(all).reduce((sum, arr) => sum + arr.length, 0);
}
