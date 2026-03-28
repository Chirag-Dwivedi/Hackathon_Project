import { useState } from 'react'
import { askStyleAssistant } from './api.js'
import { useAuth } from './AuthContext.jsx'

import ClosetView from './ClosetView.jsx'
import ExploreView from './ExploreView.jsx'
import MoodboardView from './MoodboardView.jsx'
import SearchView from './SearchView.jsx'

const tabs = ['Moodboard', 'Closet', 'Search', 'Explore']

const currentThemes = ['minimal tailoring', 'soft glam', 'neutral layers']
const priorBoards = ['Paris spring', 'Gallery night', 'Off-duty basics']
const preferences = ['earth tones', 'structured coats', 'low-key shine']
const quickPrompts = [
  'Describe this fit',
  'What item is missing?',
  'Make this more streetwear',
  'Give me a cheaper alternative vibe',
  'What shoes would go with this?',
]

function AiResponseSections({ response }) {
  const sections = [
    ['Style summary', response.styleSummary],
    ['Why it works', response.whyItWorks],
    ['Suggested addition', response.suggestedAddition],
    ['Closet management', response.closetManagement],
    ['Outfit completion', response.outfitCompletion],
  ].filter(([, value]) => value)

  const listSections = [
    ['Recommendations', response.recommendations],
    ['Item care details', response.itemCareDetails],
    ['Style suggestions', response.styleSuggestions],
    ['Similar item search', response.similarItemSearch],
  ].filter(([, value]) => Array.isArray(value) && value.length)

  return (
    <div className="ai-response-body">
      {response.answer ? <p className="ai-response-answer">{response.answer}</p> : null}

      {sections.map(([label, value]) => (
        <section key={label} className="ai-section">
          <p className="ai-section-label">{label}</p>
          <p>{value}</p>
        </section>
      ))}

      {listSections.map(([label, values]) => (
        <section key={label} className="ai-section">
          <p className="ai-section-label">{label}</p>
          <ul className="ai-bullet-list">
            {values.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Dashboard() {
  const { user, onLogout } = useAuth()
  const [activeTab, setActiveTab] = useState('Moodboard')
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [assistantInput, setAssistantInput] = useState('')
  const [assistantLoading, setAssistantLoading] = useState(false)
  const [assistantError, setAssistantError] = useState('')
  const [messages, setMessages] = useState([])
  const [moodboardContext, setMoodboardContext] = useState({
    boardTitle: 'Untitled Moodboard',
    items: [],
    outfits: [],
    selectedOutfitId: null,
  })

  const submitPrompt = async (promptText) => {
    const prompt = promptText.trim()
    if (!prompt) {
      return
    }

    setAssistantOpen(true)
    setAssistantLoading(true)
    setAssistantError('')

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      prompt,
    }

    setMessages((current) => [...current, userMessage])
    setAssistantInput('')

    try {
      const response = await askStyleAssistant({
        prompt,
        items: moodboardContext.items,
        outfits: moodboardContext.outfits,
        preferences,
        boardTitle: moodboardContext.boardTitle,
      })

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          prompt,
          response,
        },
      ])
    } catch (error) {
      setAssistantError(error.message || 'Unable to get AI styling advice right now.')
    } finally {
      setAssistantLoading(false)
    }
  }

  const hasBoardContent = moodboardContext.items.length > 0

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

      <section className="workspace-grid workspace-grid--assistant">
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
            className={`profile-orb ai-launcher ${assistantOpen ? 'is-open' : ''}`}
            aria-label="Open AI stylist"
            title="Open AI stylist"
            onClick={() => setAssistantOpen((current) => !current)}
          >
            <span className="ai-launcher-mark">AI</span>
          </button>
        </aside>

        <section className="workspace-panel">
          {activeTab === 'Moodboard' ? (
            <MoodboardView onBoardContextChange={setMoodboardContext} />
          ) : null}
          {activeTab === 'Closet' ? <ClosetView /> : null}
          {activeTab === 'Search' ? <SearchView /> : null}
          {activeTab === 'Explore' ? <ExploreView /> : null}
        </section>

        {assistantOpen ? (
          <aside className="ai-assistant-panel">
            <div className="ai-assistant-header">
              <div>
                <p className="kicker">AI stylist</p>
                <h2>Gemini side panel</h2>
              </div>
              <button
                type="button"
                className="ai-close"
                onClick={() => setAssistantOpen(false)}
                aria-label="Close AI assistant"
              >
                ×
              </button>
            </div>

            <div className="ai-context-card">
              <strong>{moodboardContext.boardTitle || 'Untitled Moodboard'}</strong>
              <span>
                {moodboardContext.items.length} item{moodboardContext.items.length === 1 ? '' : 's'} on
                the board
              </span>
              <span>
                {moodboardContext.outfits.length} outfit{moodboardContext.outfits.length === 1 ? '' : 's'} linked
              </span>
            </div>

            <div className="ai-quick-actions">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="ai-prompt-chip"
                  onClick={() => submitPrompt(prompt)}
                  disabled={assistantLoading}
                >
                  {prompt}
                </button>
              ))}
            </div>

            {!hasBoardContent ? (
              <div className="ai-empty-state">
                <h3>Add clothing first</h3>
                <p>
                  Upload a few pieces to the moodboard and the AI can describe the fit, suggest
                  missing items, and help complete the outfit.
                </p>
              </div>
            ) : (
              <div className="ai-thread">
                {messages.length === 0 ? (
                  <div className="ai-empty-state ai-empty-state--soft">
                    <h3>Ask anything about the fit</h3>
                    <p>
                      Try “What shoes would go with this?” or “Make this more streetwear.”
                    </p>
                  </div>
                ) : null}

                {messages.map((message) =>
                  message.role === 'user' ? (
                    <article key={message.id} className="ai-message ai-message--user">
                      <p>{message.prompt}</p>
                    </article>
                  ) : (
                    <article key={message.id} className="ai-message ai-message--assistant">
                      <AiResponseSections response={message.response} />
                    </article>
                  ),
                )}

                {assistantLoading ? (
                  <article className="ai-message ai-message--assistant ai-message--loading">
                    <span className="ai-loading-dot" />
                    <span className="ai-loading-dot" />
                    <span className="ai-loading-dot" />
                  </article>
                ) : null}
              </div>
            )}

            {assistantError ? <p className="moodboard-error ai-inline-error">{assistantError}</p> : null}

            <form
              className="ai-composer"
              onSubmit={(event) => {
                event.preventDefault()
                submitPrompt(assistantInput)
              }}
            >
              <textarea
                value={assistantInput}
                onChange={(event) => setAssistantInput(event.target.value)}
                placeholder="Describe this fit, ask what item is missing, or request a new vibe..."
                rows={4}
              />
              <button
                type="submit"
                className="save-button"
                disabled={assistantLoading || !assistantInput.trim() || !hasBoardContent}
              >
                {assistantLoading ? 'Thinking...' : 'Ask AI'}
              </button>
            </form>
          </aside>
        ) : null}
      </section>
    </main>
  )
}

export default Dashboard
