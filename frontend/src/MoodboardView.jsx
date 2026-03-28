import { useEffect, useRef, useState } from 'react'
import { getMoodboard, getMoodboards, saveMoodboard } from './api.js'

const CARD_WIDTH = 152
const CARD_HEIGHT = 188

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function formatTitle(name) {
  return name
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim()
}

function guessCategory(title) {
  const value = title.toLowerCase()

  if (/(blazer|jacket|coat|hoodie|cardigan|trench)/.test(value)) return 'Jacket'
  if (/(shirt|top|tee|camisole|blouse|sweater)/.test(value)) return 'Top'
  if (/(pant|trouser|jean|skirt|short)/.test(value)) return 'Pants'
  if (/(dress|gown|slip)/.test(value)) return 'Dress'
  if (/(shoe|loafer|heel|boot|sneaker|sandal)/.test(value)) return 'Shoes'
  if (/(bag|purse|tote|clutch)/.test(value)) return 'Accessory'
  return 'Piece'
}

function cardTint(category) {
  const palette = {
    Jacket: 'linear-gradient(180deg, #efe6db 0%, #e6d8c5 100%)',
    Top: 'linear-gradient(180deg, #f6ebeb 0%, #eadccc 100%)',
    Pants: 'linear-gradient(180deg, #e8ecef 0%, #d9e1ea 100%)',
    Dress: 'linear-gradient(180deg, #f3e8e2 0%, #ead4ce 100%)',
    Shoes: 'linear-gradient(180deg, #e1d9d1 0%, #cec2b5 100%)',
    Accessory: 'linear-gradient(180deg, #efe5cf 0%, #e4d7b1 100%)',
    Piece: 'linear-gradient(180deg, #f3ede4 0%, #e3d8c9 100%)',
  }

  return palette[category] ?? palette.Piece
}

function buildLink(from, to) {
  const [start, end] = [from, to].sort()
  return { id: `${start}-${end}`, from: start, to: end }
}

function makeOutfitName(counter) {
  return `Look ${String(counter).padStart(2, '0')}`
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'))
    reader.readAsDataURL(file)
  })
}

function getNextOutfitNumber(outfits) {
  const numbers = outfits
    .map((outfit) => {
      const match = /(\d+)$/.exec(outfit.name ?? '')
      return match ? Number(match[1]) : null
    })
    .filter((value) => Number.isFinite(value))

  return numbers.length ? Math.max(...numbers) + 1 : 1
}

function MoodboardView({ onBoardContextChange = () => {} }) {
  const [items, setItems] = useState([])
  const [outfits, setOutfits] = useState([])
  const [selectedOutfitId, setSelectedOutfitId] = useState(null)
  const [pendingLinkId, setPendingLinkId] = useState(null)
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 })
  const [boardTitle, setBoardTitle] = useState('Untitled Moodboard')
  const [savedBoards, setSavedBoards] = useState([])
  const [activeMoodboardId, setActiveMoodboardId] = useState(null)
  const [loadingBoards, setLoadingBoards] = useState(true)
  const [loadingBoardId, setLoadingBoardId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const boardRef = useRef(null)
  const nextOutfitNumber = useRef(1)
  const dragStateRef = useRef(null)
  const dragFrameRef = useRef(null)
  const pendingDragPositionRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function loadBoards() {
      try {
        const boards = await getMoodboards()
        if (!cancelled) {
          setSavedBoards(boards)
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || 'Unable to load saved moodboards.')
        }
      } finally {
        if (!cancelled) {
          setLoadingBoards(false)
        }
      }
    }

    loadBoards()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!boardRef.current) {
      return undefined
    }

    const updateBoardSize = () => {
      const rect = boardRef.current?.getBoundingClientRect()
      if (!rect) return
      setBoardSize({ width: rect.width, height: rect.height })
    }

    updateBoardSize()

    const observer = new ResizeObserver(updateBoardSize)
    observer.observe(boardRef.current)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!boardSize.width || !boardSize.height) {
      return
    }

    setItems((current) =>
      current.map((item) => ({
        ...item,
        x: clamp(item.x, 16, Math.max(16, boardSize.width - CARD_WIDTH - 16)),
        y: clamp(item.y, 24, Math.max(24, boardSize.height - CARD_HEIGHT - 24)),
      })),
    )
  }, [boardSize.height, boardSize.width])

  useEffect(() => {
    const flushPendingDrag = () => {
      dragFrameRef.current = null

      if (!pendingDragPositionRef.current) {
        return
      }

      const nextPosition = pendingDragPositionRef.current
      pendingDragPositionRef.current = null

      setItems((current) =>
        current.map((item) =>
          item.id === nextPosition.itemId
            ? { ...item, x: nextPosition.x, y: nextPosition.y }
            : item,
        ),
      )
    }

    const handlePointerMove = (event) => {
      if (!dragStateRef.current) {
        return
      }

      const nextX = clamp(
        event.clientX - dragStateRef.current.boardLeft - dragStateRef.current.offsetX,
        16,
        Math.max(16, boardSize.width - CARD_WIDTH - 16),
      )
      const nextY = clamp(
        event.clientY - dragStateRef.current.boardTop - dragStateRef.current.offsetY,
        24,
        Math.max(24, boardSize.height - CARD_HEIGHT - 24),
      )

      pendingDragPositionRef.current = {
        itemId: dragStateRef.current.itemId,
        x: nextX,
        y: nextY,
      }

      if (!dragFrameRef.current) {
        dragFrameRef.current = window.requestAnimationFrame(flushPendingDrag)
      }
    }

    const handlePointerUp = () => {
      dragStateRef.current = null

      if (dragFrameRef.current) {
        window.cancelAnimationFrame(dragFrameRef.current)
        dragFrameRef.current = null
      }

      if (pendingDragPositionRef.current) {
        const nextPosition = pendingDragPositionRef.current
        pendingDragPositionRef.current = null

        setItems((current) =>
          current.map((item) =>
            item.id === nextPosition.itemId
              ? { ...item, x: nextPosition.x, y: nextPosition.y }
              : item,
          ),
        )
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      if (dragFrameRef.current) {
        window.cancelAnimationFrame(dragFrameRef.current)
      }
    }
  }, [boardSize.height, boardSize.width])

  const getOutfitByItemId = (itemId, source = outfits) =>
    source.find((outfit) => outfit.itemIds.includes(itemId)) ?? null

  const selectedOutfit = outfits.find((outfit) => outfit.id === selectedOutfitId) ?? null

  useEffect(() => {
    onBoardContextChange({
      boardTitle,
      items,
      outfits,
      selectedOutfitId,
      activeMoodboardId,
    })
  }, [activeMoodboardId, boardTitle, items, onBoardContextChange, outfits, selectedOutfitId])

  const hydrateMoodboard = (moodboard) => {
    const nextItems = (moodboard.items ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      imageUrl: item.imageUrl,
      x: item.x,
      y: item.y,
      tint: cardTint(item.category),
    }))

    const nextOutfits = moodboard.outfits ?? []

    setItems(nextItems)
    setOutfits(nextOutfits)
    setSelectedOutfitId(moodboard.selectedOutfitId ?? nextOutfits[0]?.id ?? null)
    setBoardTitle(moodboard.title)
    setActiveMoodboardId(moodboard.id)
    setPendingLinkId(null)
    nextOutfitNumber.current = getNextOutfitNumber(nextOutfits)
  }

  const refreshSavedBoards = async (preferredBoardId = null) => {
    const boards = await getMoodboards()
    setSavedBoards(boards)

    if (preferredBoardId && !boards.some((board) => board.id === preferredBoardId)) {
      setActiveMoodboardId(null)
    }
  }

  const handleUpload = async (event) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) {
      return
    }

    setErrorMessage('')
    setStatusMessage('')

    try {
      const nextImages = await Promise.all(
        files.map(async (file, index) => {
          const imageUrl = await readFileAsDataUrl(file)
          return { file, imageUrl, index }
        }),
      )

      setItems((current) => {
        const additions = nextImages.map(({ file, imageUrl, index }) => {
          const sequence = current.length + index
          const column = sequence % 3
          const row = Math.floor(sequence / 3)
          const title = formatTitle(file.name)
          const category = guessCategory(title)

          return {
            id: crypto.randomUUID(),
            title,
            category,
            imageUrl,
            x: 36 + column * 190 + row * 12,
            y: 42 + row * 206,
            tint: cardTint(category),
          }
        })

        return [...current, ...additions]
      })
    } catch (error) {
      setErrorMessage(error.message || 'Unable to read one of the uploaded files.')
    } finally {
      event.target.value = ''
    }
  }

  const handleCreateNewBoard = () => {
    setItems([])
    setOutfits([])
    setSelectedOutfitId(null)
    setPendingLinkId(null)
    setBoardTitle('Untitled Moodboard')
    setActiveMoodboardId(null)
    setStatusMessage('')
    setErrorMessage('')
    nextOutfitNumber.current = 1
  }

  const removeItem = (itemId) => {
    setPendingLinkId((current) => (current === itemId ? null : current))
    setItems((current) => current.filter((item) => item.id !== itemId))

    setOutfits((current) => {
      const nextOutfits = current
        .map((outfit) => ({
          ...outfit,
          itemIds: outfit.itemIds.filter((value) => value !== itemId),
          links: outfit.links.filter((link) => link.from !== itemId && link.to !== itemId),
        }))
        .filter((outfit) => outfit.itemIds.length > 1)

      if (!nextOutfits.some((outfit) => outfit.id === selectedOutfitId)) {
        setSelectedOutfitId(nextOutfits[0]?.id ?? null)
      }

      nextOutfitNumber.current = getNextOutfitNumber(nextOutfits)
      return nextOutfits
    })
  }

  const startDrag = (event, itemId) => {
    if (event.target.closest('button') || event.target.closest('input')) {
      return
    }

    const boardRect = boardRef.current?.getBoundingClientRect()
    const activeItem = items.find((item) => item.id === itemId)
    if (!boardRect || !activeItem) {
      return
    }

    const activeOutfit = getOutfitByItemId(itemId)
    if (activeOutfit) {
      setSelectedOutfitId(activeOutfit.id)
    }

    dragStateRef.current = {
      itemId,
      boardLeft: boardRect.left,
      boardTop: boardRect.top,
      offsetX: event.clientX - boardRect.left - activeItem.x,
      offsetY: event.clientY - boardRect.top - activeItem.y,
    }
  }

  const connectItems = (firstId, secondId) => {
    if (!firstId || firstId === secondId) {
      setPendingLinkId(null)
      return
    }

    const nextLink = buildLink(firstId, secondId)
    let nextSelectedId = null

    setOutfits((current) => {
      const firstOutfit = current.find((outfit) => outfit.itemIds.includes(firstId)) ?? null
      const secondOutfit = current.find((outfit) => outfit.itemIds.includes(secondId)) ?? null

      if (firstOutfit && secondOutfit && firstOutfit.id === secondOutfit.id) {
        const updated = firstOutfit.links.some((link) => link.id === nextLink.id)
          ? firstOutfit
          : { ...firstOutfit, links: [...firstOutfit.links, nextLink] }
        nextSelectedId = updated.id
        return current.map((outfit) => (outfit.id === updated.id ? updated : outfit))
      }

      if (firstOutfit && secondOutfit && firstOutfit.id !== secondOutfit.id) {
        const merged = {
          ...firstOutfit,
          itemIds: Array.from(new Set([...firstOutfit.itemIds, ...secondOutfit.itemIds])),
          links: [...firstOutfit.links, ...secondOutfit.links],
        }

        if (!merged.links.some((link) => link.id === nextLink.id)) {
          merged.links.push(nextLink)
        }

        nextSelectedId = merged.id
        return current
          .filter((outfit) => outfit.id !== secondOutfit.id)
          .map((outfit) => (outfit.id === merged.id ? merged : outfit))
      }

      if (firstOutfit || secondOutfit) {
        const existing = firstOutfit ?? secondOutfit
        const updated = {
          ...existing,
          itemIds: Array.from(new Set([...existing.itemIds, firstId, secondId])),
          links: existing.links.some((link) => link.id === nextLink.id)
            ? existing.links
            : [...existing.links, nextLink],
        }

        nextSelectedId = updated.id
        return current.map((outfit) => (outfit.id === updated.id ? updated : outfit))
      }

      const created = {
        id: `outfit-${crypto.randomUUID()}`,
        name: makeOutfitName(nextOutfitNumber.current),
        itemIds: [firstId, secondId],
        links: [nextLink],
      }

      nextOutfitNumber.current += 1
      nextSelectedId = created.id
      return [...current, created]
    })

    setSelectedOutfitId(nextSelectedId)
    setPendingLinkId(null)
  }

  const handleLinkClick = (itemId) => {
    if (!pendingLinkId) {
      setPendingLinkId(itemId)
      return
    }

    if (pendingLinkId === itemId) {
      setPendingLinkId(null)
      return
    }

    connectItems(pendingLinkId, itemId)
  }

  const handleOpenMoodboard = async (moodboardId) => {
    setLoadingBoardId(moodboardId)
    setErrorMessage('')
    setStatusMessage('')

    try {
      const moodboard = await getMoodboard(moodboardId)
      hydrateMoodboard(moodboard)
      setStatusMessage(`Opened "${moodboard.title}".`)
    } catch (error) {
      setErrorMessage(error.message || 'Unable to open that moodboard.')
    } finally {
      setLoadingBoardId(null)
    }
  }

  const handleSaveMoodboard = async () => {
    const trimmedTitle = boardTitle.trim()
    if (trimmedTitle.length < 2) {
      setErrorMessage('Give your moodboard a name before saving it.')
      return
    }

    setSaving(true)
    setErrorMessage('')
    setStatusMessage('')

    try {
      const payload = {
        title: trimmedTitle,
        coverImageUrl: items[0]?.imageUrl ?? null,
        selectedOutfitId,
        items: items.map((item) => ({
          id: item.id,
          title: item.title,
          category: item.category,
          imageUrl: item.imageUrl,
          x: Math.round(item.x),
          y: Math.round(item.y),
        })),
        outfits,
      }

      const saved = await saveMoodboard(payload, activeMoodboardId)
      setActiveMoodboardId(saved.id)
      await refreshSavedBoards(saved.id)
      setStatusMessage(`Saved "${trimmedTitle}".`)
    } catch (error) {
      setErrorMessage(error.message || 'Unable to save this moodboard.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="moodboard-view moodboard-studio">
      <div className="panel-header moodboard-header">
        <div>
          <p className="kicker">Whiteboard studio</p>
          <h1>Moodboard</h1>
          <p className="moodboard-subtitle">
            Upload clothing, drag pieces into place, connect them into looks, and save named
            boards you can reopen from the side rail.
          </p>
        </div>

        <div className="moodboard-actions">
          <label className="upload-button">
            Upload clothing
            <input type="file" accept="image/*" multiple onChange={handleUpload} />
          </label>
          <button type="button" className="secondary-button" onClick={handleCreateNewBoard}>
            New board
          </button>
        </div>
      </div>

      <div className="moodboard-savebar">
        <label className="moodboard-name-field">
          <span className="kicker">Moodboard name</span>
          <input
            type="text"
            value={boardTitle}
            onChange={(event) => setBoardTitle(event.target.value)}
            placeholder="City Editorial"
          />
        </label>

        <button
          type="button"
          className="save-button"
          onClick={handleSaveMoodboard}
          disabled={saving}
        >
          {saving ? 'Saving...' : activeMoodboardId ? 'Update moodboard' : 'Save moodboard'}
        </button>
      </div>

      {statusMessage ? <p className="moodboard-status">{statusMessage}</p> : null}
      {errorMessage ? <p className="moodboard-error">{errorMessage}</p> : null}

      <div className="moodboard-layout">
        <section
          ref={boardRef}
          className={`board-canvas board-canvas--whiteboard ${items.length ? 'is-populated' : ''}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setPendingLinkId(null)
            }
          }}
        >
          <svg className="board-links" aria-hidden="true">
            {outfits.map((outfit) =>
              outfit.links.map((link) => {
                const from = items.find((item) => item.id === link.from)
                const to = items.find((item) => item.id === link.to)

                if (!from || !to) {
                  return null
                }

                return (
                  <line
                    key={link.id}
                    x1={from.x + CARD_WIDTH / 2}
                    y1={from.y + CARD_HEIGHT / 2}
                    x2={to.x + CARD_WIDTH / 2}
                    y2={to.y + CARD_HEIGHT / 2}
                    className={selectedOutfitId === outfit.id ? 'board-link is-active' : 'board-link'}
                  />
                )
              }),
            )}
          </svg>

          {items.length === 0 ? (
            <div className="empty-canvas empty-canvas--board">
              <div className="spark-mark" aria-hidden="true">
                *
              </div>
              <h2>Start your styling board</h2>
              <p>
                Upload clothing first, then drag pieces around and connect cards into outfit groups.
              </p>
            </div>
          ) : null}

          {items.map((item) => {
            const outfit = getOutfitByItemId(item.id)
            const isSelected = outfit?.id === selectedOutfitId

            return (
              <article
                key={item.id}
                className={[
                  'wardrobe-card',
                  isSelected ? 'is-selected' : '',
                  pendingLinkId === item.id ? 'is-linking' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ transform: `translate(${item.x}px, ${item.y}px)` }}
                onPointerDown={(event) => startDrag(event, item.id)}
                onClick={() => {
                  if (outfit) {
                    setSelectedOutfitId(outfit.id)
                  }
                }}
              >
                <button
                  type="button"
                  className="wardrobe-remove"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remove ${item.title}`}
                >
                  ×
                </button>

                <div className="wardrobe-media" style={{ background: item.tint }}>
                  <img src={item.imageUrl} alt={item.title} draggable="false" />
                </div>

                <div className="wardrobe-copy">
                  <span>{item.category}</span>
                  <h3>{item.title}</h3>
                </div>

                <button
                  type="button"
                  className="wardrobe-link"
                  onClick={() => handleLinkClick(item.id)}
                  aria-label={
                    pendingLinkId === item.id
                      ? `Cancel linking ${item.title}`
                      : `Link ${item.title} into an outfit`
                  }
                />
              </article>
            )
          })}

          {pendingLinkId ? (
            <div className="board-tip">Choose another item to connect and form an outfit.</div>
          ) : null}
        </section>

        <aside className="fit-panel fit-panel--stacked">
          <section className="saved-board-panel">
            <div className="saved-board-heading">
              <div>
                <p className="kicker">Saved boards</p>
                <h3>Thumbnail rail</h3>
              </div>
              {loadingBoards ? <span className="saved-board-meta">Loading...</span> : null}
            </div>

            <div className="saved-board-list">
              {savedBoards.length ? (
                savedBoards.map((board) => (
                  <button
                    key={board.id}
                    type="button"
                    className={[
                      'saved-board-card',
                      board.id === activeMoodboardId ? 'is-active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => handleOpenMoodboard(board.id)}
                    disabled={loadingBoardId === board.id}
                  >
                    <span className="saved-board-thumb">
                      {board.thumbnailUrl ? <img src={board.thumbnailUrl} alt="" /> : <em>Empty</em>}
                    </span>
                    <span className="saved-board-copy">
                      <strong>{board.title}</strong>
                      <small>
                        {loadingBoardId === board.id
                          ? 'Opening...'
                          : `${board.itemCount} item${board.itemCount === 1 ? '' : 's'}`}
                      </small>
                    </span>
                  </button>
                ))
              ) : (
                <div className="fit-empty fit-empty--compact">
                  <h3>No saved boards yet</h3>
                  <p>Save your current arrangement and a thumbnail will appear here.</p>
                </div>
              )}
            </div>
          </section>

          <section>
            <p className="kicker">Selected fit</p>
            {selectedOutfit ? (
              <>
                <h2>{selectedOutfit.name}</h2>
                <p className="fit-panel-note">
                  Drag pieces to refine the layout. Save the board when the outfit feels right.
                </p>

                <div className="fit-item-list">
                  {selectedOutfit.itemIds.map((itemId) => {
                    const item = items.find((entry) => entry.id === itemId)
                    if (!item) return null

                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="fit-item"
                        onClick={() => setSelectedOutfitId(selectedOutfit.id)}
                      >
                        <span className="fit-thumb" style={{ background: item.tint }}>
                          <img src={item.imageUrl} alt="" />
                        </span>
                        <span className="fit-copy">
                          <strong>{item.title}</strong>
                          <small>{item.category.toLowerCase()}</small>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="fit-empty">
                <h3>No outfit selected</h3>
                <p>
                  Click one link dot, then another, to connect clothing items into an outfit group.
                </p>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

export default MoodboardView
