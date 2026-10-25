import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Castle,
  Upload,
  FileJson,
  CheckCircle2,
  AlertCircle,
  Trash2,
  LoaderCircle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
import { importVillage, getSavedVillage } from '../services/api'

const VILLAGE_KEYS = [
  'buildings2',
  'traps2',
  'decos2',
  'obstacles2',
  'units2',
  'heroes2',
  'pets2',
  'equipment2',
]

export default function Dashboard() {
  const navigate = useNavigate()

  const [jsonData, setJsonData] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSaved, setCheckingSaved] = useState(true)
  const [savedVillage, setSavedVillage] = useState(null)
  const [showImportForm, setShowImportForm] = useState(false)

  useEffect(() => {
    let active = true

    async function loadSavedVillage() {
      const token = localStorage.getItem('token')

      if (!token) {
        if (active) {
          setCheckingSaved(false)
          setSavedVillage(null)
          setShowImportForm(true)
        }
        return
      }

      try {
        const response = await getSavedVillage()

        if (!active) return

        const result = response.data

        if (result.success && result.saved) {
          setSavedVillage(result)
          setShowImportForm(false)
        } else {
          setSavedVillage(null)
          setShowImportForm(true)
        }
      } catch (err) {
        if (!active) return

        if (err.response?.status === 401) {
          setError('Your session has expired. Please log in again.')
        } else {
          setError(
            err.response?.data?.message ||
            'Could not load your saved village. You can try importing it again.'
          )
        }

        setShowImportForm(true)
      } finally {
        if (active) setCheckingSaved(false)
      }
    }

    loadSavedVillage()

    return () => {
      active = false
    }
  }, [])

  function handleContinue(village = savedVillage) {
    if (!village?.villageData) {
      setError('Saved village data is unavailable. Please import your village again.')
      setShowImportForm(true)
      return
    }

    navigate('/category', {
      state: {
        villageData: village.villageData,
        playerTag: village.playerTag,
        currentTownHall: Number(village.currentTownHall) || 0,
      },
    })
  }

  async function handleValidate() {
    setError('')

    let parsedData

    try {
      parsedData = JSON.parse(jsonData)
    } catch {
      setError('Invalid JSON. Please check your file content.')
      return
    }

    if (!parsedData || typeof parsedData !== 'object' || Array.isArray(parsedData)) {
      setError('The JSON must contain a valid village object.')
      return
    }

    const hasVillageData = VILLAGE_KEYS.some(
      (key) => Array.isArray(parsedData[key])
    )

    if (!hasVillageData) {
      setError('The JSON does not contain the expected village data.')
      return
    }

    if (!parsedData.tag || typeof parsedData.tag !== 'string') {
      setError('Player tag is missing from the JSON.')
      return
    }

    if (!localStorage.getItem('token')) {
      setError('Please log in before importing your village.')
      return
    }

    setLoading(true)

    try {
      const response = await importVillage({
        villageData: parsedData,
      })

      const result = response.data

      if (!result.success) {
        setError(result.message || 'Village import failed.')
        return
      }

      const village = {
        success: true,
        saved: true,
        playerTag: result.playerTag,
        currentTownHall: result.currentTownHall,
        villageData: parsedData,
      }

      setSavedVillage(village)
      setJsonData('')
      setShowImportForm(false)

      handleContinue(village)
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Failed to import village. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  function handleClear() {
    setJsonData('')
    setError('')
  }

  if (checkingSaved) {
    return (
      <div className="min-h-screen bg-[#080d1b] text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-cyan-400">
          <LoaderCircle className="animate-spin" size={22} />
          <span>Loading your village...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080d1b] text-white px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-3">
            <Castle className="text-cyan-400" size={28} />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-wide sm:text-3xl">
              ClashTrack
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Your Clash of Clans village tracker
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            <AlertCircle className="mt-0.5 shrink-0" size={19} />
            <span>{error}</span>
          </div>
        )}

        {savedVillage && !showImportForm && (
          <div className="rounded-2xl border border-cyan-400/25 bg-[#101a2d] p-5 shadow-lg shadow-cyan-950/20 sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <CheckCircle2 className="text-emerald-400" size={25} />

              <div>
                <h2 className="text-xl font-semibold">
                  Your village is saved
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  You don't need to upload your JSON again.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-700 bg-[#0a1222] p-4">
                <p className="text-xs uppercase tracking-wider text-slate-400">
                  Player Tag
                </p>
                <p className="mt-2 break-all text-lg font-semibold text-cyan-300">
                  {savedVillage.playerTag}
                </p>
              </div>

              <div className="rounded-xl border border-slate-700 bg-[#0a1222] p-4">
                <p className="text-xs uppercase tracking-wider text-slate-400">
                  Town Hall Level
                </p>
                <p className="mt-2 text-lg font-semibold text-cyan-300">
                  {savedVillage.currentTownHall
                    ? `Town Hall ${savedVillage.currentTownHall}`
                    : 'Not available'}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => handleContinue()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Continue to Categories
                <ArrowRight size={18} />
              </button>

              <button
                onClick={() => {
                  setError('')
                  setShowImportForm(true)
                }}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-600 px-5 py-3 font-medium text-slate-200 transition hover:border-cyan-400 hover:text-cyan-300"
              >
                <RefreshCw size={17} />
                Import Another Village
              </button>
            </div>
          </div>
        )}

        {showImportForm && (
          <div className="rounded-2xl border border-cyan-400/20 bg-[#101a2d] p-5 shadow-lg shadow-cyan-950/20 sm:p-8">
            <div className="mb-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg bg-cyan-400/10 p-2.5">
                  <FileJson className="text-cyan-400" size={23} />
                </div>

                <div>
                  <h2 className="text-xl font-semibold">
                    Import Village JSON
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Paste your village JSON below to save or update your village.
                  </p>
                </div>
              </div>
            </div>

            <textarea
              value={jsonData}
              onChange={(event) => setJsonData(event.target.value)}
              placeholder='Paste your Clash of Clans JSON here, e.g. { "tag": "#ABC123", ... }'
              spellCheck={false}
              className="min-h-[280px] w-full resize-y rounded-xl border border-slate-700 bg-[#080d1b] p-4 font-mono text-sm leading-6 text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-400"
            />

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleValidate}
                disabled={loading || !jsonData.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <LoaderCircle className="animate-spin" size={18} />
                ) : (
                  <Upload size={18} />
                )}
                {loading ? 'Importing...' : 'Validate & Import JSON'}
              </button>

              <button
                onClick={handleClear}
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-600 px-5 py-3 text-slate-300 transition hover:border-red-400 hover:text-red-300 disabled:opacity-50"
              >
                <Trash2 size={17} />
                Clear
              </button>
            </div>

            {savedVillage && (
              <button
                onClick={() => {
                  setError('')
                  setShowImportForm(false)
                }}
                className="mt-4 text-sm text-cyan-300 transition hover:text-cyan-200"
              >
                Cancel and return to saved village
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}