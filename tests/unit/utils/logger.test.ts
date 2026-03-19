import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setQuiet, info, warn, error, success, debug } from '../../../src/utils/logger.js';

describe('logger utils', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset quiet mode before each test
    setQuiet(false);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Clear debug env var
    delete process.env['DOMAINKIT_DEBUG'];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env['DOMAINKIT_DEBUG'];
    // Reset quiet state
    setQuiet(false);
  });

  // ---------------------------------------------------------------------------
  // setQuiet / info
  // ---------------------------------------------------------------------------

  describe('setQuiet', () => {
    it('suppresses info when quiet mode is enabled', () => {
      setQuiet(true);
      info('silent message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('allows info when quiet mode is disabled', () => {
      setQuiet(false);
      info('loud message');
      expect(consoleLogSpy).toHaveBeenCalledOnce();
    });

    it('suppresses warn when quiet mode is enabled', () => {
      setQuiet(true);
      warn('silent warning');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('suppresses success when quiet mode is enabled', () => {
      setQuiet(true);
      success('silent success');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('does NOT suppress error even in quiet mode', () => {
      setQuiet(true);
      error('critical error');
      expect(consoleErrorSpy).toHaveBeenCalledOnce();
    });
  });

  // ---------------------------------------------------------------------------
  // debug
  // ---------------------------------------------------------------------------

  describe('debug', () => {
    it('does not log when DOMAINKIT_DEBUG is not set', () => {
      delete process.env['DOMAINKIT_DEBUG'];
      debug('debug message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('logs when DOMAINKIT_DEBUG is set to a truthy value', () => {
      process.env['DOMAINKIT_DEBUG'] = '1';
      debug('debug message');
      expect(consoleLogSpy).toHaveBeenCalledOnce();
    });

    it('does not log when quiet mode is enabled even if DOMAINKIT_DEBUG is set', () => {
      process.env['DOMAINKIT_DEBUG'] = '1';
      setQuiet(true);
      debug('suppressed debug message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // individual log functions
  // ---------------------------------------------------------------------------

  describe('info', () => {
    it('calls console.log', () => {
      info('hello info');
      expect(consoleLogSpy).toHaveBeenCalledOnce();
    });
  });

  describe('warn', () => {
    it('calls console.warn', () => {
      warn('hello warn');
      expect(consoleWarnSpy).toHaveBeenCalledOnce();
    });
  });

  describe('error', () => {
    it('calls console.error', () => {
      error('hello error');
      expect(consoleErrorSpy).toHaveBeenCalledOnce();
    });
  });

  describe('success', () => {
    it('calls console.log', () => {
      success('hello success');
      expect(consoleLogSpy).toHaveBeenCalledOnce();
    });
  });
});
