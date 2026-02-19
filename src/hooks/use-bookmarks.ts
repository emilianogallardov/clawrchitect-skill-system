"use client"

import { useState, useEffect, useCallback } from "react"

export interface BookmarkEntry {
  id: string
  name: string
}

const STORAGE_KEY = "clawcamp-bookmarks"
const SYNC_EVENT = "clawcamp-bookmarks-sync"

function readBookmarks(): BookmarkEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>(readBookmarks)

  useEffect(() => {

    // Cross-tab sync
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setBookmarks(readBookmarks())
      }
    }
    // Same-tab sync between hook instances
    function onSync() {
      setBookmarks(readBookmarks())
    }
    window.addEventListener("storage", onStorage)
    window.addEventListener(SYNC_EVENT, onSync)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener(SYNC_EVENT, onSync)
    }
  }, [])

  const toggle = useCallback((entry: BookmarkEntry) => {
    setBookmarks((prev) => {
      const exists = prev.some((b) => b.id === entry.id)
      const next = exists
        ? prev.filter((b) => b.id !== entry.id)
        : [...prev, entry]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      // Defer so other hook instances update after this render completes
      queueMicrotask(() => window.dispatchEvent(new Event(SYNC_EVENT)))
      return next
    })
  }, [])

  const isBookmarked = useCallback(
    (id: string) => bookmarks.some((b) => b.id === id),
    [bookmarks]
  )

  return { bookmarks, toggle, isBookmarked }
}
