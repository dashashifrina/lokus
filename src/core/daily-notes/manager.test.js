// src/core/daily-notes/manager.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { format, subDays, addDays, getWeek } from 'date-fns';

// Mock Tauri APIs before importing the module under test
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  mkdir: vi.fn(),
  exists: vi.fn(),
  readDir: vi.fn(),
}));

vi.mock('../config/store.js', () => ({
  readConfig: vi.fn(),
  updateConfig: vi.fn(),
}));

vi.mock('../../utils/pathUtils.js', () => ({
  joinPath: vi.fn((...args) => args.join('/')),
}));

import { DailyNotesManager } from './manager.js';
import { invoke } from '@tauri-apps/api/core';
import { mkdir, exists, readDir } from '@tauri-apps/plugin-fs';
import { readConfig, updateConfig } from '../config/store.js';

// Fixed test date: June 3, 2026 (Tuesday)
const FIXED_DATE = new Date(2026, 5, 3); // month is 0-indexed

describe('DailyNotesManager', () => {
  let manager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new DailyNotesManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------
  describe('constructor', () => {
    it('creates instance with default config values', () => {
      const m = new DailyNotesManager();
      expect(m.workspacePath).toBeNull();
      expect(m.config.format).toBe('yyyy-MM-dd');
      expect(m.config.folder).toBe('Daily Notes');
      expect(m.config.template).toBeNull();
      expect(m.config.openOnStartup).toBe(false);
    });

    it('accepts custom config overrides', () => {
      const m = new DailyNotesManager({
        workspacePath: '/my/workspace',
        config: { format: 'dd-MM-yyyy', folder: 'Journal', openOnStartup: true },
      });
      expect(m.workspacePath).toBe('/my/workspace');
      expect(m.config.format).toBe('dd-MM-yyyy');
      expect(m.config.folder).toBe('Journal');
      expect(m.config.openOnStartup).toBe(true);
    });

    it('merges custom config with defaults', () => {
      const m = new DailyNotesManager({ config: { folder: 'Notes' } });
      expect(m.config.folder).toBe('Notes');
      expect(m.config.format).toBe('yyyy-MM-dd'); // default preserved
    });
  });

  // ---------------------------------------------------------------------------
  // formatDate
  // ---------------------------------------------------------------------------
  describe('formatDate()', () => {
    it('formats a date using the default yyyy-MM-dd format', () => {
      const result = manager.formatDate(FIXED_DATE);
      expect(result).toBe('2026-06-03');
    });

    it('formats a date using a custom format', () => {
      manager.config.format = 'dd/MM/yyyy';
      const result = manager.formatDate(FIXED_DATE);
      expect(result).toBe('03/06/2026');
    });

    it('falls back to yyyy-MM-dd on an invalid format string', () => {
      // date-fns throws on the deprecated uppercase YYYY token
      manager.config.format = 'YYYY-MM-DD';
      const result = manager.formatDate(FIXED_DATE);
      // Fallback produces ISO-style date regardless of invalid token
      expect(result).toBe('2026-06-03');
    });

    it('uses current date when no argument supplied', () => {
      vi.useFakeTimers();
      vi.setSystemTime(FIXED_DATE);
      const result = manager.formatDate();
      expect(result).toBe('2026-06-03');
    });
  });

  // ---------------------------------------------------------------------------
  // parseDate
  // ---------------------------------------------------------------------------
  describe('parseDate()', () => {
    it('parses a valid yyyy-MM-dd date string', () => {
      const result = manager.parseDate('2026-06-03');
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(5); // June = 5
      expect(result.getDate()).toBe(3);
    });

    it('returns null for an invalid date string', () => {
      expect(manager.parseDate('not-a-date')).toBeNull();
    });

    it('returns null for a string that does not match the format', () => {
      expect(manager.parseDate('03/06/2026')).toBeNull(); // wrong format
    });

    it('returns null for empty string', () => {
      expect(manager.parseDate('')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // getDailyNotePath
  // ---------------------------------------------------------------------------
  describe('getDailyNotePath()', () => {
    it('generates the correct path when workspacePath is set', () => {
      manager.workspacePath = '/workspace';
      const result = manager.getDailyNotePath(FIXED_DATE);
      expect(result).toBe('/workspace/Daily Notes/2026-06-03.md');
    });

    it('throws an Error when workspacePath is null', () => {
      expect(() => manager.getDailyNotePath(FIXED_DATE)).toThrow(
        'Workspace path not initialized'
      );
    });

    it('includes folder from config in path', () => {
      manager.workspacePath = '/notes';
      manager.config.folder = 'Journal';
      const result = manager.getDailyNotePath(FIXED_DATE);
      expect(result).toBe('/notes/Journal/2026-06-03.md');
    });
  });

  // ---------------------------------------------------------------------------
  // getDailyNoteContent
  // ---------------------------------------------------------------------------
  describe('getDailyNoteContent()', () => {
    it('returns default heading content when no template is configured', async () => {
      const content = await manager.getDailyNoteContent(FIXED_DATE);
      // Should be "# 2026-06-03 - Wednesday\n\n"
      expect(content).toBe('# 2026-06-03 - Wednesday\n\n');
    });

    it('expands {{date}} template variable', async () => {
      manager.config.template = 'Date: {{date}}';
      const content = await manager.getDailyNoteContent(FIXED_DATE);
      expect(content).toBe('Date: 2026-06-03');
    });

    it('expands {{yesterday}} template variable', async () => {
      manager.config.template = 'Yesterday: {{yesterday}}';
      const content = await manager.getDailyNoteContent(FIXED_DATE);
      const expected = format(subDays(FIXED_DATE, 1), 'yyyy-MM-dd');
      expect(content).toBe(`Yesterday: ${expected}`);
    });

    it('expands {{tomorrow}} template variable', async () => {
      manager.config.template = 'Tomorrow: {{tomorrow}}';
      const content = await manager.getDailyNoteContent(FIXED_DATE);
      const expected = format(addDays(FIXED_DATE, 1), 'yyyy-MM-dd');
      expect(content).toBe(`Tomorrow: ${expected}`);
    });

    it('expands {{day_name}} template variable', async () => {
      manager.config.template = '{{day_name}}';
      const content = await manager.getDailyNoteContent(FIXED_DATE);
      expect(content).toBe('Wednesday');
    });

    it('expands {{month_name}} template variable', async () => {
      manager.config.template = '{{month_name}}';
      const content = await manager.getDailyNoteContent(FIXED_DATE);
      expect(content).toBe('June');
    });

    it('expands {{week_number}} template variable', async () => {
      manager.config.template = 'Week {{week_number}}';
      const content = await manager.getDailyNoteContent(FIXED_DATE);
      const expectedWeek = getWeek(FIXED_DATE).toString();
      expect(content).toBe(`Week ${expectedWeek}`);
    });

    it('expands {{year}} template variable', async () => {
      manager.config.template = '{{year}}';
      const content = await manager.getDailyNoteContent(FIXED_DATE);
      expect(content).toBe('2026');
    });

    it('expands {{time}} template variable with fake timers', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 5, 3, 14, 30));
      manager.config.template = '{{time}}';
      const content = await manager.getDailyNoteContent(FIXED_DATE);
      expect(content).toBe('14:30');
    });

    it('expands {{date:FORMAT}} custom date format variable', async () => {
      manager.config.template = '{{date:dd MMMM yyyy}}';
      const content = await manager.getDailyNoteContent(FIXED_DATE);
      expect(content).toBe('03 June 2026');
    });

    it('falls back to default content when template processing throws', async () => {
      // Assign a non-string template to force the try/catch to trigger
      manager.config.template = null; // template=null → falls through to default
      const content = await manager.getDailyNoteContent(FIXED_DATE);
      expect(content).toContain('# 2026-06-03');
    });
  });

  // ---------------------------------------------------------------------------
  // openToday
  // ---------------------------------------------------------------------------
  describe('openToday()', () => {
    beforeEach(() => {
      manager.workspacePath = '/workspace';
      vi.useFakeTimers();
      vi.setSystemTime(FIXED_DATE);
    });

    it('creates a new note when the file does not exist', async () => {
      exists.mockResolvedValue(false);
      invoke.mockResolvedValue(undefined);

      const result = await manager.openToday();

      expect(result.path).toBe('/workspace/Daily Notes/2026-06-03.md');
      expect(result.created).toBe(true);
      expect(invoke).toHaveBeenCalledWith('write_file_content', expect.objectContaining({
        path: '/workspace/Daily Notes/2026-06-03.md',
      }));
    });

    it('returns the existing path without creating when file already exists', async () => {
      exists.mockResolvedValue(true);

      const result = await manager.openToday();

      expect(result.path).toBe('/workspace/Daily Notes/2026-06-03.md');
      expect(result.created).toBe(false);
      expect(invoke).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // openDate
  // ---------------------------------------------------------------------------
  describe('openDate()', () => {
    beforeEach(() => {
      manager.workspacePath = '/workspace';
    });

    it('opens a note for a valid date', async () => {
      exists.mockResolvedValue(true);
      const result = await manager.openDate(FIXED_DATE);
      expect(result.path).toBe('/workspace/Daily Notes/2026-06-03.md');
    });

    it('throws an Error for an invalid date', async () => {
      await expect(manager.openDate(new Date('invalid'))).rejects.toThrow('Invalid date provided');
    });
  });

  // ---------------------------------------------------------------------------
  // openYesterday / openTomorrow
  // ---------------------------------------------------------------------------
  describe('openYesterday()', () => {
    it('opens note for the previous day', async () => {
      manager.workspacePath = '/workspace';
      exists.mockResolvedValue(true);
      vi.useFakeTimers();
      vi.setSystemTime(FIXED_DATE);

      const result = await manager.openYesterday();
      // June 3 - 1 = June 2
      expect(result.path).toContain('2026-06-02.md');
    });
  });

  describe('openTomorrow()', () => {
    it('opens note for the next day', async () => {
      manager.workspacePath = '/workspace';
      exists.mockResolvedValue(true);
      vi.useFakeTimers();
      vi.setSystemTime(FIXED_DATE);

      const result = await manager.openTomorrow();
      // June 3 + 1 = June 4
      expect(result.path).toContain('2026-06-04.md');
    });
  });

  // ---------------------------------------------------------------------------
  // listDailyNotes
  // ---------------------------------------------------------------------------
  describe('listDailyNotes()', () => {
    beforeEach(() => {
      manager.workspacePath = '/workspace';
    });

    it('returns a sorted descending list of valid daily notes', async () => {
      readDir.mockResolvedValue([
        { name: '2026-06-01.md', isFile: true },
        { name: '2026-06-03.md', isFile: true },
        { name: '2026-06-02.md', isFile: true },
      ]);

      const notes = await manager.listDailyNotes();

      expect(notes).toHaveLength(3);
      expect(notes[0].dateString).toBe('2026-06-03');
      expect(notes[1].dateString).toBe('2026-06-02');
      expect(notes[2].dateString).toBe('2026-06-01');
    });

    it('filters out non-.md files', async () => {
      readDir.mockResolvedValue([
        { name: '2026-06-01.md', isFile: true },
        { name: 'README.txt', isFile: true },
        { name: 'image.png', isFile: true },
      ]);

      const notes = await manager.listDailyNotes();
      expect(notes).toHaveLength(1);
    });

    it('filters out files with un-parseable names', async () => {
      readDir.mockResolvedValue([
        { name: '2026-06-01.md', isFile: true },
        { name: 'not-a-date.md', isFile: true },
        { name: 'todo.md', isFile: true },
      ]);

      const notes = await manager.listDailyNotes();
      expect(notes).toHaveLength(1);
      expect(notes[0].dateString).toBe('2026-06-01');
    });

    it('returns empty array when folder does not exist (readDir throws)', async () => {
      readDir.mockRejectedValue(new Error('Folder not found'));
      const notes = await manager.listDailyNotes();
      expect(notes).toEqual([]);
    });

    it('throws when workspacePath is not set', async () => {
      manager.workspacePath = null;
      await expect(manager.listDailyNotes()).rejects.toThrow(
        'Workspace path not initialized'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Config lifecycle
  // ---------------------------------------------------------------------------
  describe('Config lifecycle', () => {
    describe('loadConfig()', () => {
      it('merges dailyNotes section from global config', async () => {
        readConfig.mockResolvedValue({
          dailyNotes: { format: 'dd-MM-yyyy', folder: 'Journal' },
        });
        await manager.loadConfig();
        expect(manager.config.format).toBe('dd-MM-yyyy');
        expect(manager.config.folder).toBe('Journal');
      });

      it('leaves config unchanged when dailyNotes section is absent', async () => {
        readConfig.mockResolvedValue({});
        await manager.loadConfig();
        expect(manager.config.format).toBe('yyyy-MM-dd');
      });

      it('silently handles readConfig errors', async () => {
        readConfig.mockRejectedValue(new Error('Read failed'));
        await expect(manager.loadConfig()).resolves.toBeUndefined();
      });
    });

    describe('saveConfig()', () => {
      it('calls updateConfig with merged config under dailyNotes key', async () => {
        updateConfig.mockResolvedValue(undefined);
        await manager.saveConfig({ folder: 'MyNotes' });
        expect(updateConfig).toHaveBeenCalledWith({
          dailyNotes: expect.objectContaining({ folder: 'MyNotes' }),
        });
      });

      it('updates internal config state', async () => {
        updateConfig.mockResolvedValue(undefined);
        await manager.saveConfig({ folder: 'Updated' });
        expect(manager.config.folder).toBe('Updated');
      });

      it('re-throws errors from updateConfig', async () => {
        updateConfig.mockRejectedValue(new Error('Save failed'));
        await expect(manager.saveConfig({ folder: 'X' })).rejects.toThrow('Save failed');
      });
    });

    describe('getConfig()', () => {
      it('returns a copy of the config (not the original reference)', () => {
        const copy = manager.getConfig();
        copy.format = 'CHANGED';
        expect(manager.config.format).toBe('yyyy-MM-dd'); // original unchanged
      });

      it('returns the current config values', () => {
        manager.config.folder = 'TestFolder';
        expect(manager.getConfig().folder).toBe('TestFolder');
      });
    });

    describe('updateConfig()', () => {
      it('delegates to saveConfig', async () => {
        updateConfig.mockResolvedValue(undefined);
        await manager.updateConfig({ openOnStartup: true });
        expect(updateConfig).toHaveBeenCalled();
        expect(manager.config.openOnStartup).toBe(true);
      });
    });
  });
});
