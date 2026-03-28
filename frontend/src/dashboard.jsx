import { useState } from 'react'
import { useAuth } from './AuthContext.jsx'

import ClosetView from './ClosetView.jsx'
import ExploreView from './ExploreView.jsx'
import MoodboardView from './MoodboardView.jsx'
import SearchView from './SearchView.jsx'

const tabs = ['Moodboard', 'Closet', 'Search', 'Explore']

const currentThemes = ['minimal tailoring', 'soft glam', 'neutral layers']
const priorBoards = ['Paris spring', 'Gallery night', 'Off-duty basics']
const preferences = ['earth tones', 'structured coats', 'low-key shine']

function Dashboard() {
  const { user, onLogout } = useAuth()
  const [activeTab, setActiveTab] = useState('Moodboard')

  return (
    <main className="workspace-shell">
      <header className="topbar">
        <div className="brand-mark">
          <span className="brand-badge">Sleeves</span>
        </div>

        <nav className="tab-row" aria-label="Primary tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`tab-pill ${activeTab === tab ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>

        {/* User info + logout */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              {user.name.split(' ')[0]}
            </span>
            <button
              type="button"
              onClick={onLogout}
              style={{
                padding: '0.6rem 1.1rem',
                borderRadius: '999px',
                border: '1px solid var(--line-strong)',
                background: 'transparent',
                color: 'var(--ink)',
                fontSize: '0.84rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </header>

      <section className="workspace-grid">
        <aside className="sidebar">
          <div className="sidebar-group">
            <p className="sidebar-label">Current interests / themes</p>
            <div className="sidebar-list">
              {currentThemes.map((theme) => (
                <button key={theme} type="button" className="side-chip">
                  {theme}
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-group">
            <p className="sidebar-label">Prior boards</p>
            <div className="sidebar-list">
              {priorBoards.map((board) => (
                <button key={board} type="button" className="side-chip">
                  {board}
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-group">
            <p className="sidebar-label">Set preferences</p>
            <div className="sidebar-list">
              {preferences.map((preference) => (
                <button key={preference} type="button" className="side-chip">
                  {preference}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="profile-orb"
            aria-label="Profile"
            title={user?.name}
          />
        </aside>

        <section className="workspace-panel">
          {activeTab === 'Moodboard' ? <MoodboardView /> : null}
          {activeTab === 'Closet' ? <ClosetView /> : null}
          {activeTab === 'Search' ? <SearchView /> : null}
          {activeTab === 'Explore' ? <ExploreView /> : null}
        </section>
      </section>
    </main>
  )
}

export default Dashboard
