// src/mcp-server/tools/daily-notes.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

// Mock fs/promises before importing the module under test
vi.mock('fs/promises', () => {
  const readFile = vi.fn();
  const writeFile = vi.fn();
  const readdir = vi.fn();
  const mkdir = vi.fn();
  const stat = vi.fn();
  return {
    default: { readFile, writeFile, readdir, mkdir, stat },
    readFile,
    writeFile,
    readdir,
    mkdir,
    stat,
  };
});

import { executeDailyNotesTool } from './daily-notes.js';
import { readFile, writeFile, readdir, mkdir, stat } from 'fs/promises';

// Fixed test date: June 3, 2026 (Tuesday)
const FIXED_DATE = new Date(2026, 5, 3, 10, 0, 0); // 2026-06-03 10:00:00

const WORKSPACE = '/home/user/notes';
const DAILY_NOTES_FOLDER = path.join(WORKSPACE, 'Daily Notes');

describe('daily-notes MCP tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_DATE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // getDailyNote (via executeDailyNotesTool)
  // ---------------------------------------------------------------------------
  describe('getDailyNote() — via today/yesterday/tomorrow/date actions', () => {
    it('creates folder and file when note does not exist', async () => {
      mkdir.mockResolvedValue(undefined);
      readFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      writeFile.mockResolvedValue(undefined);

      const response = await executeDailyNotesTool('daily_note', { action: 'today' }, WORKSPACE);
      const result = JSON.parse(response.content[0].text);

      expect(mkdir).toHaveBeenCalledWith(DAILY_NOTES_FOLDER, { recursive: true });
      expect(writeFile).toHaveBeenCalled();
      expect(result.created).toBe(true);
      expect(result.date).toBe('2026-06-03');
    });

    it('returns existing content without re-creating when file exists', async () => {
      mkdir.mockResolvedValue(undefined);
      readFile.mockResolvedValue('# 2026-06-03 - Wednesday\n\nsome existing content');
      writeFile.mockResolvedValue(undefined);

      const response = await executeDailyNotesTool('daily_note', { action: 'today' }, WORKSPACE);
      const result = JSON.parse(response.content[0].text);

      expect(writeFile).not.toHaveBeenCalled();
      expect(result.created).toBe(false);
      expect(result.content).toContain('some existing content');
    });
  });

  // ---------------------------------------------------------------------------
  // listDailyNotes (via list action)
  // ---------------------------------------------------------------------------
  describe('listDailyNotes() — via list action', () => {
    it('returns sorted list of daily notes', async () => {
      readdir.mockResolvedValue(['2026-06-01.md', '2026-06-03.md', '2026-06-02.md']);
      stat.mockResolvedValue({ mtime: new Date('2026-06-03T10:00:00Z') });

      const response = await executeDailyNotesTool(
        'daily_note',
        { action: 'list' },
        WORKSPACE
      );
      const result = JSON.parse(response.content[0].text);

      expect(result.success).toBe(true);
      expect(result.action).toBe('list');
      // Notes should be sorted descending by date string
      expect(result.notes[0].date).toBe('2026-06-03');
      expect(result.notes[1].date).toBe('2026-06-02');
      expect(result.notes[2].date).toBe('2026-06-01');
    });

    it('respects the limit parameter', async () => {
      readdir.mockResolvedValue([
        '2026-06-01.md',
        '2026-06-02.md',
        '2026-06-03.md',
        '2026-06-04.md',
        '2026-06-05.md',
      ]);
      stat.mockResolvedValue({ mtime: new Date('2026-06-05T10:00:00Z') });

      const response = await executeDailyNotesTool(
        'daily_note',
        { action: 'list', limit: 2 },
        WORKSPACE
      );
      const result = JSON.parse(response.content[0].text);

      expect(result.notes).toHaveLength(2);
    });

    it('returns empty array when folder does not exist', async () => {
      readdir.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

      const response = await executeDailyNotesTool(
        'daily_note',
        { action: 'list' },
        WORKSPACE
      );
      const result = JSON.parse(response.content[0].text);

      expect(result.notes).toEqual([]);
      expect(result.count).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // executeDailyNotesTool — all 5 actions
  // ---------------------------------------------------------------------------
  describe('executeDailyNotesTool() — all actions', () => {
    beforeEach(() => {
      mkdir.mockResolvedValue(undefined);
      writeFile.mockResolvedValue(undefined);
    });

    it('today action returns correct shape', async () => {
      readFile.mockResolvedValue('# 2026-06-03 - Wednesday\n\n');

      const response = await executeDailyNotesTool('daily_note', { action: 'today' }, WORKSPACE);
      const result = JSON.parse(response.content[0].text);

      expect(result.success).toBe(true);
      expect(result.action).toBe('today');
      expect(result.date).toBe('2026-06-03');
      expect(result.dayName).toBe('Wednesday');
      expect(result.path).toBeTruthy();
      expect(result.message).toMatch(/today/i);
    });

    it('yesterday action returns note for previous day', async () => {
      readFile.mockRejectedValue(new Error('ENOENT'));

      const response = await executeDailyNotesTool(
        'daily_note',
        { action: 'yesterday' },
        WORKSPACE
      );
      const result = JSON.parse(response.content[0].text);

      expect(result.success).toBe(true);
      expect(result.action).toBe('yesterday');
      expect(result.date).toBe('2026-06-02'); // one day before June 3
    });

    it('tomorrow action returns note for next day', async () => {
      readFile.mockRejectedValue(new Error('ENOENT'));

      const response = await executeDailyNotesTool(
        'daily_note',
        { action: 'tomorrow' },
        WORKSPACE
      );
      const result = JSON.parse(response.content[0].text);

      expect(result.success).toBe(true);
      expect(result.action).toBe('tomorrow');
      expect(result.date).toBe('2026-06-04'); // one day after June 3
    });

    it('date action returns note for a specific date', async () => {
      readFile.mockResolvedValue('# 2026-05-15 - Friday\n\n');

      const response = await executeDailyNotesTool(
        'daily_note',
        { action: 'date', date: '2026-05-15' },
        WORKSPACE
      );
      const result = JSON.parse(response.content[0].text);

      expect(result.success).toBe(true);
      expect(result.action).toBe('date');
      expect(result.date).toBe('2026-05-15');
    });

    it('list action returns correct shape', async () => {
      readdir.mockResolvedValue(['2026-06-03.md']);
      stat.mockResolvedValue({ mtime: new Date('2026-06-03T10:00:00Z') });

      const response = await executeDailyNotesTool(
        'daily_note',
        { action: 'list' },
        WORKSPACE
      );
      const result = JSON.parse(response.content[0].text);

      expect(result.success).toBe(true);
      expect(result.action).toBe('list');
      expect(Array.isArray(result.notes)).toBe(true);
      expect(typeof result.count).toBe('number');
      expect(result.message).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  // Error cases
  // ---------------------------------------------------------------------------
  describe('Error cases', () => {
    it('throws for an unknown tool name', async () => {
      await expect(
        executeDailyNotesTool('unknown_tool', { action: 'today' }, WORKSPACE)
      ).rejects.toThrow('Unknown tool: unknown_tool');
    });

    it('throws for an unknown action', async () => {
      await expect(
        executeDailyNotesTool('daily_note', { action: 'invalid_action' }, WORKSPACE)
      ).rejects.toThrow('Unknown action: invalid_action');
    });

    it('throws when date action is called without a date parameter', async () => {
      await expect(
        executeDailyNotesTool('daily_note', { action: 'date' }, WORKSPACE)
      ).rejects.toThrow('Date parameter required');
    });

    it('throws when date action receives an invalid date format', async () => {
      await expect(
        executeDailyNotesTool('daily_note', { action: 'date', date: 'not-a-date' }, WORKSPACE)
      ).rejects.toThrow('Invalid date format: not-a-date');
    });
  });
});
