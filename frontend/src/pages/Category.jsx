
import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Castle,
  Building2,
  Wrench,
  Swords,
  FlaskConical,
  PawPrint,
  Shield,
  Clock3,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react'
import API, { getImageUrl } from '../services/api'

const CATEGORIES = [
  {
    name: 'Buildings',
    image: '/images/home/defenses/eagle-artillery/normal/level-1.png',
    icon: Building2,
    color: 'text-cyan-300',
    border: 'hover:border-cyan-400/50',
    route: '/building',
  },
  {
    name: 'Equipment',
    image: '/images/home/hero-equipment/action-figure/icon.png',
    icon: Wrench,
    color: 'text-amber-300',
    border: 'hover:border-amber-400/50',
    route: '/equipment',
  },
  {
    name: 'Heroes',
    image: '/images/home/army-buildings/hero-banner/barbarian-king.png',
    icon: Swords,
    color: 'text-fuchsia-300',
    border: 'hover:border-fuchsia-400/50',
    route: '/heroes',
  },
  {
    name: 'Laboratory',
    image: '/images/home/army-buildings/laboratory/normal/level-1.png',
    icon: FlaskConical,
    color: 'text-purple-300',
    border: 'hover:border-purple-400/50',
    route: '/laboratory',
  },
  {
    name: 'Pets',
    image: '/images/home/pets/electro-owl/normal.png',
    icon: PawPrint,
    color: 'text-emerald-300',
    border: 'hover:border-emerald-400/50',
    route: '/pets',
  },
  {
    name: 'Walls',
    image: '/images/home/defenses/wall/normal/level-1.png',
    icon: Shield,
    color: 'text-blue-300',
    border: 'hover:border-blue-400/50',
    route: '/walls',
  },
]

const normalize = (value = '') =>
  String(value).toLowerCase().replace(/[\s_-]/g, '').trim()

const formatNumber = (value) =>
  Number(value || 0).toLocaleString('en-US')

const formatDuration = (seconds = 0) => {
  let remaining = Math.max(0, Math.round(Number(seconds) || 0))
  const totalDays = Math.floor(remaining / 86400)

  if (totalDays >= 30) {
    const years = Math.floor(totalDays / 365)
    const afterYears = totalDays % 365
    const months = Math.floor(afterYears / 30)
    const days = afterYears % 30
    const parts = []

    if (years) parts.push(`${years}y`)
    if (months) parts.push(`${months}mo`)
    if (days) parts.push(`${days}d`)

    return parts.join(' ')
  }

  const days = totalDays
  remaining %= 86400

  const hours = Math.floor(remaining / 3600)
  remaining %= 3600

  const minutes = Math.floor(remaining / 60)
  const parts = []

  if (days) parts.push(`${days}d`)
  if (hours) parts.push(`${hours}h`)
  if (minutes || parts.length === 0) parts.push(`${minutes}m`)

  return parts.join(' ')
}

const formatCosts = (costs = {}) => {
  if (typeof costs === 'number' || typeof costs === 'string') {
    return Number(costs) > 0
      ? formatNumber(costs)
      : 'No remaining cost'
  }

  if (!costs || typeof costs !== 'object') {
    return 'Cost unavailable'
  }

  const entries = Object.entries(costs).filter(
    ([, amount]) => Number(amount) > 0
  )

  if (!entries.length) return 'No remaining cost'

  return entries
    .map(([resource, amount]) =>
      `${formatNumber(amount)} ${resource}`
    )
    .join(' · ')
}

const Category = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const villageData = location.state?.villageData

  const playerTag =
    location.state?.playerTag ??
    villageData?.playerTag ??
    villageData?.tag ??
    villageData?.tag2 ??
    ''

  // Fixed to the Town Hall detected during village import.
  // There is no Town Hall selector.
  const currentTownHall = Number(
    location.state?.currentTownHall ??
    villageData?.currentTownHall
  )

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadData = async () => {
    if (!playerTag) {
      setError(
        'Player tag is missing. Return to the dashboard and import your village again.'
      )
      return
    }

    if (
      !Number.isInteger(currentTownHall) ||
      currentTownHall < 1 ||
      currentTownHall > 18
    ) {
      setError(
        'Current Town Hall level is missing. Return to the dashboard and import your village again.'
      )
      return
    }

    try {
      setLoading(true)
      setError('')

      // Existing backend route: POST /api/upgrade/calculate
      const response = await API.post('/upgrade/calculate', {
        playerTag,
        targetTownHall: currentTownHall,
      })

      const result = response.data

      if (result?.success === false) {
        throw new Error(
          result.message || 'Upgrade calculation failed.'
        )
      }

      setData(result)
    } catch (err) {
      console.error(
        'Upgrade calculation error:',
        err.response?.data || err
      )

      setError(
        err.response?.data?.message ||
          err.message ||
          `Unable to load upgrade information${
            err.response?.status
              ? ` (HTTP ${err.response.status})`
              : ''
          }.`
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerTag, currentTownHall])

  const items = data?.items || []

  const categoryCards = useMemo(
    () =>
      CATEGORIES.map((category) => {
        const categoryItems = items.filter((item) => {
          const itemCategory = normalize(item.category)
          const name = normalize(category.name)

          if (name === 'buildings') {
            return ['building', 'buildings'].includes(itemCategory)
          }

          if (name === 'laboratory') {
            return [
              'laboratory',
              'lab',
              'troops',
              'spells',
              'siege',
            ].includes(itemCategory)
          }

          return itemCategory === name
        })

        const progress = (data?.categoryProgress || []).find(
          (entry) =>
            normalize(entry.category) === normalize(category.name)
        )

        const completedItems = categoryItems.filter(
          (item) =>
            Number(item.maxAllowedLevel) > 0 &&
            Number(item.currentLevel) >=
              Number(item.maxAllowedLevel)
        ).length

        return {
          ...category,
          items: categoryItems,
          progress: Number(progress?.progressPercent || 0),
          itemCount: categoryItems.length,
          completedItems,
          completedLevels: Number(
            progress?.completedLevels || 0
          ),
          totalLevels: Number(progress?.totalLevels || 0),
          remainingTimeSeconds: Number(
            progress?.remainingTimeSeconds || 0
          ),
          estimatedSeconds: Number(
            progress?.estimatedSeconds ??
              progress?.remainingTimeSeconds ??
              0
          ),
          remainingCost: progress?.remainingCost || {},
        }
      }),
    [items, data]
  )

  const handleCategoryClick = (category) => {
    if (!category.route) return

    navigate(category.route, {
      state: {
        playerTag,
        currentTownHall,
        villageData,
        categoryName: category.name,
        upgradeData: data,
      },
    })
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070914] px-4 py-8 text-white sm:px-8 lg:px-12">
      {/* Full-page attacking Barbarian background */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <img
          src={getImageUrl('/images/raged.jpg')}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-center opacity-25"
          style={{ transform: 'scaleX(-1)' }}
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
        />
        {/* Preserve the dark CLASHTRACK appearance and readable text */}
        <div className="absolute inset-0 bg-[#070914]/65" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#070914]/70 via-transparent to-[#070914]/60" />
      </div>

      <div className="ambient ambient-one pointer-events-none absolute z-[1]" />
      <div className="ambient ambient-two pointer-events-none absolute z-[1]" />

      <main className="relative z-10 mx-auto max-w-7xl">
        {/* Header */}
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="neon-icon">
              <Castle size={25} />
            </div>

            <div>
              <h1 className="text-xl font-black tracking-wide">
                CLASH<span className="text-cyan-400">TRACK</span>
              </h1>
              <p className="text-[10px] tracking-[0.3em] text-slate-500">
                VILLAGE INTELLIGENCE
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-300"
          >
            <ArrowLeft size={16} />
            Dashboard
          </button>
        </header>

        {/* Heading */}
        <section className="mb-8">
          <p className="text-xs font-bold tracking-[0.25em] text-cyan-400">
            VILLAGE OVERVIEW
          </p>

          <h2 className="mt-3 text-3xl font-black sm:text-4xl">
            Upgrade <span className="neon-text">Categories.</span>
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Track completed levels, remaining upgrades, costs, and time
            for your village.
          </p>

          {data && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-2 text-sm">
              <Castle size={17} className="text-cyan-300" />
              <span className="text-slate-300">Current Town Hall</span>
              <span className="font-black text-cyan-300">
                TH{data.currentTownHall ?? currentTownHall}
              </span>
            </div>
          )}
        </section>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-4 text-sm text-rose-300"
          >
            <AlertCircle size={20} className="mt-0.5 shrink-0" />

            <div className="flex-1">
              <p>{error}</p>

              {playerTag && (
                <button
                  type="button"
                  onClick={loadData}
                  disabled={loading}
                  className="mt-3 inline-flex items-center gap-2 font-bold underline underline-offset-4 disabled:opacity-50"
                >
                  <RefreshCw size={14} />
                  Try again
                </button>
              )}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="neon-panel mb-6 flex items-center justify-center gap-3 p-8 text-cyan-300">
            <LoaderCircle size={22} className="animate-spin" />
            Loading village upgrade data...
          </div>
        )}

        {/* Summary */}
        {data && (
          <section className="neon-panel mb-8 grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
            <div>
              <p className="text-xs tracking-widest text-slate-500">
                OVERALL PROGRESS
              </p>

              <p className="mt-2 text-3xl font-black text-cyan-300">
                {Number(
                  data.builderSummary?.progressPercent ??
                    data.overallProgressPercent ??
                    0
                ).toFixed(1)}%
              </p>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-cyan-300"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        Number(
                          data.builderSummary?.progressPercent ??
                            data.overallProgressPercent ??
                            0
                        ) || 0
                      )
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <p className="text-xs tracking-widest text-slate-500">
                REMAINING UPGRADE TIME
              </p>

              <p className="mt-2 text-2xl font-black text-purple-300">
                {formatDuration(
                  data.timeEstimate?.realisticSeconds ??
                    data.totals?.upgradeTimeSeconds
                )}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Buildings + Heroes ÷ {data.timeEstimate?.builders ?? 6} builders
              </p>

              {data.timeEstimate && (
                <p className="mt-1 text-[11px] text-slate-600">
                  Laboratory {formatDuration(data.timeEstimate.laboratorySeconds)}
                  {' · '}
                  Pets {formatDuration(data.timeEstimate.petsSeconds)}
                  {' (run separately)'}
                </p>
              )}
            </div>
          </section>
        )}

        {/* Six main categories */}
        <section className="mb-10">
          <div className="mb-5">
            <p className="text-xs font-bold tracking-[0.25em] text-cyan-400">
              SIX MAIN CATEGORIES
            </p>

            <h3 className="mt-2 text-2xl font-black">
              Village <span className="neon-text">Progress.</span>
            </h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {categoryCards.map((category) => {
              const Icon = category.icon

              const isComplete =
                category.totalLevels > 0 &&
                category.completedLevels >= category.totalLevels

              return (
                <button
                  type="button"
                  key={category.name}
                  onClick={() => handleCategoryClick(category)}
                  aria-label={`Open ${category.name}`}
                  className={`neon-panel relative isolate w-full overflow-hidden p-5 text-left transition duration-300 group cursor-pointer hover:-translate-y-1 ${category.border}`}
                >
                  {/* Category artwork */}
                  <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
                    <img
                      src={getImageUrl(category.image)}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover object-center opacity-50 transition duration-500 group-hover:scale-105 group-hover:opacity-60"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none'
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#070914] via-[#070914]/90 to-[#070914]/45" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#070914] via-[#070914]/35 to-[#070914]/60" />
                    <div className="absolute inset-0 bg-[#070914]/10" />
                  </div>

                  <div className="relative z-10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center">
                          <img
                            src={getImageUrl(category.image)}
                            alt={category.name}
                            loading="lazy"
                            className="h-12 w-12 object-contain opacity-100"
                            onError={(event) => {
                              event.currentTarget.style.display = 'none'
                            }}
                          />
                          <Icon size={22} className={category.color} />
                        </div>

                        <div>
                          <h4 className={`font-extrabold ${category.color}`}>
                            {category.name}
                          </h4>

                          <p className="mt-1 text-xs text-slate-500">
                            {category.itemCount} saved items
                          </p>
                        </div>
                      </div>

                      {data && isComplete ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-300">
                          <CheckCircle2 size={15} />
                          Completed
                        </span>
                      ) : data ? (
                        <span className="rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-2 py-1 text-[10px] font-bold text-amber-200">
                          In progress
                        </span>
                      ) : (
                        <ChevronRight
                          size={18}
                          className={`${category.color} transition-transform group-hover:translate-x-1`}
                        />
                      )}
                    </div>

                    <div className="mt-5 flex items-center justify-between text-xs text-slate-400">
                      <span>Upgrade progress</span>
                      <span className={category.color}>
                        {category.progress.toFixed(1)}%
                      </span>
                    </div>

                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-cyan-300 transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, category.progress)
                          )}%`,
                        }}
                      />
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {formatNumber(category.completedLevels)} /{' '}
                        {formatNumber(category.totalLevels)} levels
                      </span>

                      <ChevronRight
                        size={17}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    </div>

                    {data && (
                      <div className="mt-4 space-y-2 border-t border-white/10 pt-3 text-xs">
                        <div className="flex items-start justify-between gap-3">
                          <span className="flex items-center gap-1.5 text-slate-500">
                            <Clock3 size={13} />
                            Remaining time
                          </span>

                          <span className="text-right font-bold text-purple-300">
                            {category.estimatedSeconds > 0
                              ? formatDuration(category.estimatedSeconds)
                              : 'None'}
                          </span>
                        </div>

                        {category.remainingTimeSeconds >
                          category.estimatedSeconds + 60 && (
                          <p className="text-right text-[11px] text-slate-600">
                            Total work{' '}
                            {formatDuration(category.remainingTimeSeconds)}
                          </p>
                        )}

                        <div className="flex items-start justify-between gap-3">
                          <span className="text-slate-500">
                            Remaining cost
                          </span>

                          <span className="break-words text-right font-bold text-cyan-300">
                            {formatCosts(category.remainingCost)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 text-center text-xs tracking-widest text-slate-600">
          COC BASE TRACKER <span className="mx-2 text-cyan-500">•</span>
          PLAN YOUR NEXT MOVE
        </footer>
      </main>
    </div>
  )
}

export default Category
