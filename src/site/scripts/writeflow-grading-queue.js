/**
 * WriteFlow — optimistic grading queue with local draft persistence and bulk flush.
 */
(() => {
  "use strict";

  const DEFAULT_FLUSH_MS = 2500;
  const CHUNK_SIZE = 25;

  function createGradingQueue(options = {}) {
    const {
      storageKey = "writeflow:gradingPending",
      flushDelayMs = DEFAULT_FLUSH_MS,
      saveBulk,
      onStatus,
      onApplied,
    } = options;

    const pending = new Map();
    let flushTimer = null;
    let flushing = false;

    function loadStored() {
      if (!storageKey) return;
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return;
        const rows = JSON.parse(raw);
        if (!Array.isArray(rows)) return;
        for (const row of rows) {
          if (!row?.id) continue;
          pending.set(row.id, { ...row, dirty: true, saving: false });
        }
      } catch {
        /* ignore corrupt drafts */
      }
    }

    function persist() {
      if (!storageKey) return;
      try {
        const rows = [...pending.values()]
          .filter((row) => row.dirty)
          .map(({ id, assignmentId, teacherGrade, teacherFeedback, feedbackVisible }) => ({
            id,
            assignmentId,
            teacherGrade,
            teacherFeedback,
            feedbackVisible,
          }));
        if (!rows.length) localStorage.removeItem(storageKey);
        else localStorage.setItem(storageKey, JSON.stringify(rows));
      } catch {
        /* quota */
      }
    }

    function setStatus(text, isError = false) {
      onStatus?.(text, isError);
    }

    function countDirty() {
      let n = 0;
      for (const row of pending.values()) {
        if (row.dirty) n++;
      }
      return n;
    }

    function getDraft(id) {
      return pending.get(id) || null;
    }

    function isDirty(id) {
      const row = pending.get(id);
      return !!(row && row.dirty);
    }

    function stage(id, assignmentId, data) {
      if (!id || !assignmentId) return;
      const existing = pending.get(id) || {};
      pending.set(id, {
        id,
        assignmentId,
        teacherGrade: data.teacherGrade,
        teacherFeedback: data.teacherFeedback || "",
        feedbackVisible: !!data.feedbackVisible,
        dirty: true,
        saving: existing.saving || false,
        updatedAt: Date.now(),
      });
      persist();
      scheduleFlush();
      setStatus(`${countDirty()} unsaved grade${countDirty() === 1 ? "" : "s"}`);
    }

    function clearSaved(ids) {
      for (const id of ids) {
        const row = pending.get(id);
        if (row) pending.delete(id);
      }
      persist();
      const dirty = countDirty();
      setStatus(dirty ? `${dirty} unsaved grade${dirty === 1 ? "" : "s"}` : "");
    }

    function scheduleFlush() {
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(() => void flush(), flushDelayMs);
    }

    async function flush() {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      if (flushing || !saveBulk) return { saved: 0, errors: [] };
      const batch = [...pending.values()].filter((row) => row.dirty && !row.saving);
      if (!batch.length) return { saved: 0, errors: [] };

      flushing = true;
      setStatus(`Saving ${batch.length} grade${batch.length === 1 ? "" : "s"}…`);
      let saved = 0;
      const errors = [];

      for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
        const chunk = batch.slice(i, i + CHUNK_SIZE);
        for (const row of chunk) row.saving = true;
        try {
          const result = await saveBulk(chunk.map((row) => ({
            submissionId: row.id,
            assignmentId: row.assignmentId,
            teacherGrade: row.teacherGrade,
            teacherFeedback: row.teacherFeedback,
            feedbackVisible: row.feedbackVisible,
          })));
          const applied = result?.results || [];
          for (const item of applied) {
            onApplied?.(item);
            pending.delete(item.id);
            saved++;
          }
          for (const err of result?.errors || []) {
            errors.push(err);
            const row = pending.get(err.id);
            if (row) {
              row.saving = false;
              row.dirty = true;
            }
          }
        } catch (err) {
          for (const row of chunk) {
            row.saving = false;
            errors.push({ id: row.id, error: err.message || "Save failed" });
          }
        }
      }

      persist();
      flushing = false;
      const dirty = countDirty();
      if (errors.length) {
        setStatus(`Saved ${saved}; ${errors.length} failed. ${dirty ? `${dirty} still pending.` : ""}`, true);
      } else if (dirty) {
        setStatus(`${dirty} unsaved grade${dirty === 1 ? "" : "s"}`);
      } else {
        setStatus(saved ? `Saved ${saved} grade${saved === 1 ? "" : "s"}.` : "");
      }
      return { saved, errors };
    }

    loadStored();
    return {
      stage,
      flush,
      getDraft,
      isDirty,
      countDirty,
      scheduleFlush,
    };
  }

  window.WriteFlowGradingQueue = { createGradingQueue, CHUNK_SIZE };
})();
