// src/services/daily-note-integration.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Tauri plugin-fs
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}));

// Mock the dailyNotesManager singleton
vi.mock('../core/daily-notes/index.js', () => ({
  dailyNotesManager: {
    init: vi.fn(),
    getDailyNotePath: vi.fn(),
    fileExists: vi.fn(),
    ensureFolder: vi.fn(),
    getDailyNoteContent: vi.fn(),
  },
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { formatMeetingSummarySection, insertMeetingSummary } from './daily-note-integration.js';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { dailyNotesManager } from '../core/daily-notes/index.js';

// Fixed test date
const FIXED_DATE = new Date(2026, 5, 3, 14, 30, 0);
const NOTE_PATH = '/workspace/Daily Notes/2026-06-03.md';
const WORKSPACE = '/workspace';

describe('daily-note-integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_DATE);

    // Default manager stubs
    dailyNotesManager.init.mockResolvedValue(undefined);
    dailyNotesManager.getDailyNotePath.mockReturnValue(NOTE_PATH);
    dailyNotesManager.fileExists.mockResolvedValue(false);
    dailyNotesManager.ensureFolder.mockResolvedValue(undefined);
    dailyNotesManager.getDailyNoteContent.mockResolvedValue('# 2026-06-03 - Tuesday\n\n');
    writeTextFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // formatMeetingSummarySection
  // ---------------------------------------------------------------------------
  describe('formatMeetingSummarySection()', () => {
    it('produces the correct markdown structure', () => {
      const section = formatMeetingSummarySection('Summary text', 'Q2 Planning', 0);

      expect(section).toContain('\n---\n');
      expect(section).toContain('## Meeting Notes: Q2 Planning');
      expect(section).toContain('Summary text');
    });

    it('starts with an empty line for correct spacing when appended', () => {
      const section = formatMeetingSummarySection('text', 'Title', 0);
      expect(section.startsWith('\n')).toBe(true);
    });

    it('uses "Ad-hoc Call" as the default title when meetingTitle is falsy', () => {
      const withUndefined = formatMeetingSummarySection('text', undefined, 0);
      const withNull = formatMeetingSummarySection('text', null, 0);
      const withEmpty = formatMeetingSummarySection('text', '', 0);

      expect(withUndefined).toContain('## Meeting Notes: Ad-hoc Call');
      expect(withNull).toContain('## Meeting Notes: Ad-hoc Call');
      expect(withEmpty).toContain('## Meeting Notes: Ad-hoc Call');
    });

    it('converts duration from seconds to minutes (rounded)', () => {
      const section90s = formatMeetingSummarySection('text', 'Meeting', 90);   // 1.5 → 2 min
      const section3600s = formatMeetingSummarySection('text', 'Meeting', 3600); // 60 min
      const section3723s = formatMeetingSummarySection('text', 'Meeting', 3723); // 62.05 → 62 min

      expect(section90s).toContain('2 min');
      expect(section3600s).toContain('60 min');
      expect(section3723s).toContain('62 min');
    });

    it('uses 0 minutes when duration is 0', () => {
      const section = formatMeetingSummarySection('text', 'Meeting', 0);
      expect(section).toContain('0 min');
    });

    it('includes the summary text in the output', () => {
      const section = formatMeetingSummarySection('**Action items:** Fix bug', 'Meeting');
      expect(section).toContain('**Action items:** Fix bug');
    });

    it('includes a horizontal rule separator', () => {
      const section = formatMeetingSummarySection('text', 'Meeting');
      const lines = section.split('\n');
      expect(lines).toContain('---');
    });

    it('includes the meta line with duration and Lokus attribution', () => {
      const section = formatMeetingSummarySection('text', 'Meeting', 600); // 10 min
      expect(section).toContain('10 min');
      expect(section).toContain('Recorded by Lokus');
    });
  });

  // ---------------------------------------------------------------------------
  // insertMeetingSummary
  // ---------------------------------------------------------------------------
  describe('insertMeetingSummary()', () => {
    it('creates a new note with template + summary when note does not exist', async () => {
      dailyNotesManager.fileExists.mockResolvedValue(false);

      const result = await insertMeetingSummary({
        summary: 'Meeting summary text',
        meetingTitle: 'Sprint Review',
        duration: 1800,
        workspacePath: WORKSPACE,
      });

      expect(dailyNotesManager.ensureFolder).toHaveBeenCalled();
      expect(dailyNotesManager.getDailyNoteContent).toHaveBeenCalled();
      expect(writeTextFile).toHaveBeenCalledWith(
        NOTE_PATH,
        expect.stringContaining('Meeting summary text')
      );
      expect(result.path).toBe(NOTE_PATH);
      expect(result.created).toBe(true);
    });

    it('written content starts with template content followed by summary', async () => {
      dailyNotesManager.fileExists.mockResolvedValue(false);
      dailyNotesManager.getDailyNoteContent.mockResolvedValue('# 2026-06-03 - Tuesday\n\n');

      await insertMeetingSummary({
        summary: 'My meeting summary',
        workspacePath: WORKSPACE,
      });

      const [, writtenContent] = writeTextFile.mock.calls[0];
      expect(writtenContent).toContain('# 2026-06-03 - Tuesday');
      expect(writtenContent).toContain('My meeting summary');
    });

    it('appends to an existing note without overwriting it', async () => {
      dailyNotesManager.fileExists.mockResolvedValue(true);
      readTextFile.mockResolvedValue('# 2026-06-03 - Tuesday\n\nexisting content');

      const result = await insertMeetingSummary({
        summary: 'New meeting summary',
        workspacePath: WORKSPACE,
      });

      const [, writtenContent] = writeTextFile.mock.calls[0];
      expect(writtenContent).toContain('existing content');
      expect(writtenContent).toContain('New meeting summary');
      expect(result.created).toBe(false);
      expect(result.path).toBe(NOTE_PATH);
    });

    it('strips trailing newlines from existing content before appending', async () => {
      dailyNotesManager.fileExists.mockResolvedValue(true);
      readTextFile.mockResolvedValue('existing content\n\n\n');

      await insertMeetingSummary({
        summary: 'Summary',
        workspacePath: WORKSPACE,
      });

      const [, writtenContent] = writeTextFile.mock.calls[0];
      // The existing content should not have multiple trailing newlines before the section
      expect(writtenContent).not.toMatch(/\n{3,}---/);
    });

    it('throws when workspacePath is not provided', async () => {
      await expect(
        insertMeetingSummary({ summary: 'text' })
      ).rejects.toThrow('insertMeetingSummary: workspacePath is required.');
    });

    it('throws when summary is not a string', async () => {
      await expect(
        insertMeetingSummary({ summary: 42, workspacePath: WORKSPACE })
      ).rejects.toThrow('insertMeetingSummary: summary must be a string.');

      await expect(
        insertMeetingSummary({ summary: null, workspacePath: WORKSPACE })
      ).rejects.toThrow('insertMeetingSummary: summary must be a string.');

      await expect(
        insertMeetingSummary({ summary: undefined, workspacePath: WORKSPACE })
      ).rejects.toThrow('insertMeetingSummary: summary must be a string.');
    });

    it('initialises dailyNotesManager with the provided workspacePath', async () => {
      await insertMeetingSummary({
        summary: 'text',
        workspacePath: '/my/workspace',
      });

      expect(dailyNotesManager.init).toHaveBeenCalledWith('/my/workspace');
    });
  });
});
