import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ShortcutHelpModal from './ShortcutHelpModal'

// Mock the shortcuts registry
vi.mock('../core/shortcuts/registry.js', async () => {
  const actual = await vi.importActual('../core/shortcuts/registry.js')
  return {
    ...actual,
    getActiveShortcuts: vi.fn().mockResolvedValue({
      'save-file': 'CommandOrControl+S',
      'new-file': 'CommandOrControl+N',
      'command-palette': 'CommandOrControl+K',
      'format-bold': 'CommandOrControl+B',
    }),
  }
})

// Radix UI Dialog uses portals — ensure body is available
beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>'
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('ShortcutHelpModal', () => {
  it('does not render modal content when isOpen is false', () => {
    render(<ShortcutHelpModal isOpen={false} onClose={vi.fn()} />)
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument()
  })

  it('renders modal title when open', async () => {
    render(<ShortcutHelpModal isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
  })

  it('calls onClose when Radix dialog requests close (e.g. Escape key)', async () => {
    const onClose = vi.fn()
    render(<ShortcutHelpModal isOpen={true} onClose={onClose} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('displays shortcut categories from the registry', async () => {
    render(<ShortcutHelpModal isOpen={true} onClose={vi.fn()} />)

    // Wait for async getActiveShortcuts to resolve and sections to render
    await waitFor(() => {
      expect(screen.getByText('File')).toBeInTheDocument()
    })
    expect(screen.getByText('Navigation')).toBeInTheDocument()
    expect(screen.getByText('Editor')).toBeInTheDocument()
  })

  it('renders action names from registry', async () => {
    render(<ShortcutHelpModal isOpen={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Save File')).toBeInTheDocument()
    })
    expect(screen.getByText('New File')).toBeInTheDocument()
  })

  it('uses formatAccelerator to display shortcuts', async () => {
    render(<ShortcutHelpModal isOpen={true} onClose={vi.fn()} />)
    await waitFor(() => {
      // formatAccelerator renders Ctrl+S on non-Mac, ⌘S on Mac
      // Either form should appear somewhere for the save shortcut
      const kbds = screen.getAllByRole('term')
      expect(kbds.length).toBeGreaterThan(0)
    })
  })

  it('shows loading state while fetching shortcuts', async () => {
    const { getActiveShortcuts } = await import('../core/shortcuts/registry.js')
    let resolve
    getActiveShortcuts.mockReturnValue(new Promise((r) => { resolve = r }))

    render(<ShortcutHelpModal isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByText(/loading shortcuts/i)).toBeInTheDocument()

    resolve({ 'save-file': 'CommandOrControl+S' })
    await waitFor(() => expect(screen.queryByText(/loading shortcuts/i)).not.toBeInTheDocument())
  })

  it('falls back to defaults if getActiveShortcuts rejects', async () => {
    const { getActiveShortcuts } = await import('../core/shortcuts/registry.js')
    getActiveShortcuts.mockRejectedValue(new Error('network error'))

    render(<ShortcutHelpModal isOpen={true} onClose={vi.fn()} />)

    // Should still render categories from ACTIONS defaults
    await waitFor(() => {
      expect(screen.getByText('File')).toBeInTheDocument()
    })
  })

  it('re-fetches shortcuts each time modal opens', async () => {
    const { getActiveShortcuts } = await import('../core/shortcuts/registry.js')
    const { rerender } = render(<ShortcutHelpModal isOpen={false} onClose={vi.fn()} />)

    rerender(<ShortcutHelpModal isOpen={true} onClose={vi.fn()} />)
    await waitFor(() => screen.getByText('Keyboard Shortcuts'))

    rerender(<ShortcutHelpModal isOpen={false} onClose={vi.fn()} />)
    rerender(<ShortcutHelpModal isOpen={true} onClose={vi.fn()} />)

    // Called once per open
    await waitFor(() => expect(getActiveShortcuts).toHaveBeenCalledTimes(2))
  })
})
