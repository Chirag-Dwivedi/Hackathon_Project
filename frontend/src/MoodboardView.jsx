import { useEffect, useState } from 'react'

const starterPins = [
  {
    id: 1,
    title: 'Soft Tailoring',
    note: 'Relaxed blazer with clean trousers and warm neutrals.',
    theme: 'Workwear',
    color: 'linear-gradient(160deg, #eadfce 0%, #b88d67 100%)',
  },
  {
    id: 2,
    title: 'Weekend Layering',
    note: 'Vintage denim, cotton tee, and a cropped trench.',
    theme: 'Day Off',
    color: 'linear-gradient(160deg, #d9dbc8 0%, #6f7b58 100%)',
  },
]

function MoodboardView() {
  const [uploads, setUploads] = useState([])

  useEffect(() => {
    return () => {
      uploads.forEach((upload) => URL.revokeObjectURL(upload.preview))
    }
  }, [uploads])

  const handleUpload = (event) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) {
      return
    }

    const nextUploads = files.map((file) => ({
      id: `${file.name}-${file.lastModified}`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      preview: URL.createObjectURL(file),
      size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
    }))

    setUploads((current) => [...nextUploads, ...current])
    event.target.value = ''
  }

  const removeUpload = (uploadId) => {
    setUploads((current) => {
      const target = current.find((upload) => upload.id === uploadId)
      if (target) {
        URL.revokeObjectURL(target.preview)
      }

      return current.filter((upload) => upload.id !== uploadId)
    })
  }

  return (
    <div className="moodboard-view">
      <div className="panel-header">
        <div>
          <p className="kicker">Primary board</p>
          <h1>Moodboard</h1>
        </div>
        <label className="upload-button">
          Upload outfit photos
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
          />
        </label>
      </div>

      <div className="board-canvas">
        {uploads.length === 0 ? (
          <div className="empty-canvas">
            <div className="spark-mark" aria-hidden="true">
              *
            </div>
            <h2>Start pinning outfit inspiration</h2>
            <p>
              Upload mirror selfies, saved looks, or detail shots to build your
              board.
            </p>
          </div>
        ) : (
          <div className="upload-grid">
            {uploads.map((upload) => (
              <article key={upload.id} className="upload-card">
                <img src={upload.preview} alt={upload.title} />
                <div className="upload-meta">
                  <div>
                    <strong>{upload.title}</strong>
                    <p>{upload.size}</p>
                  </div>
                  <button
                    type="button"
                    className="remove-button"
                    onClick={() => removeUpload(upload.id)}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <section className="reference-strip" aria-label="Starter inspiration">
        {starterPins.map((pin) => (
          <article
            key={pin.id}
            className="pin-card"
            style={{ backgroundImage: pin.color }}
          >
            <span>{pin.theme}</span>
            <h3>{pin.title}</h3>
            <p>{pin.note}</p>
          </article>
        ))}
      </section>
    </div>
  )
}

export default MoodboardView
