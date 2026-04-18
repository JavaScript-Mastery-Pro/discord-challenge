'use client'

import { useState, useEffect } from 'react'

interface NavbarProps {
  onMenuClick: () => void
  title: string
}

export function Navbar({ onMenuClick, title }: NavbarProps) {
  const [dark, setDark] = useState(() => {
    if (typeof document === 'undefined') {
      return false
    }

    return document.documentElement.classList.contains('dark')
  })

  // Sync dark class to <html> whenever dark state changes
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const toggleDark = () => {
    const newDark = !dark;
    setDark(newDark);
    document.documentElement.classList.toggle("dark", newDark);
    localStorage.setItem("theme", newDark ? "dark" : "light");
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 lg:px-6 shrink-0">
      {/* Left: Hamburger + Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700 lg:hidden"
          aria-label="Open menu"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-900 dark:text-white">
          {title}
        </h1>
      </div>

      {/* Right: Dark mode toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleDark}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
          aria-label="Toggle dark mode"
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          ) : (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
