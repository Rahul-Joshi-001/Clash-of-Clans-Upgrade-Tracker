import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Castle,
  PawPrint,
  Clock3,
  Coins,
  CheckCircle2,
  Search,
} from 'lucide-react'

const API_ORIGIN = 'http://localhost:3000'

const normalize = (value = '') =>
  String(value).toLowerCase().replace(/[\s_-]/g, '').trim()

const formatNumber = (value) =>
  Number(value || 0).toLocaleString('en-US')

// Converts durations into years, months, days and hours.
// Uses 365 days per year and 30 days per month for display.
const formatDuration = (seconds = 0) => {
  let remaining = Math.max(0, Math.round(Number(seconds) || 0))

  const totalDays = Math.floor(remaining / 86400)
  const hours = Math.floor((remaining % 86400) / 3600)
  const minutes = Math.floor((remaining % 3600) / 60)

  const years = Math.floor(totalDays / 365)
  const daysAfterYears = totalDays % 365
  const months = Math.floor(daysAfterYears / 30)
  const days = daysAfterYears % 30

  const parts = []

  if (years) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`)
  if (months) parts.push(`${months} ${months === 1 ? 'month' : 'months'}`)
  if (days) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`)
  if (hours) parts.push(`${hours}h`)

  if (minutes && years === 0 && months === 0) {
    parts.push(`${minutes}m`)
  }

  return parts.length ? parts.join(' ') : '0m'
}

const formatCosts = (costs) => {
  if (costs == null) return 'Not available'

  if (typeof costs === 'number' || typeof costs === 'string') {
    return Number(costs) > 0
      ? formatNumber(costs)
      : 'No remaining cost'
  }

  if (typeof costs !== 'object') return 'Not available'

  const entries = Object.entries(costs).filter(
    ([, amount]) => Number(amount) > 0
  )

  return entries.length
    ? entries
        .map(([resource, amount]) =>
          `${formatNumber(amount)} ${resource.replace(/_/g, ' ')}`
        )
        .join(' · ')
    : 'No remaining cost'
}

const getItemName = (item) =>
  item.name || item.displayName || item.itemName || item.key || 'Pet'

// Folder-safe slug. Dots and apostrophes are removed first so that
// "L.A.S.S.I" becomes "lassi" (not "l-a-s-s-i").
const toSlug = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.'’]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const getPetSlug = (item) =>
  toSlug(item.slug || item.sourceId || item.key || getItemName(item))

const getPetImage = (item) => {
  const candidate =
    item.imageUrl ||
    item.imageURL ||
    item.imagePath ||
    item.image_path ||
    item.iconUrl ||
    item.iconPath ||
    item.icon_path ||
    item.image ||
    item.icon ||
    item.assets?.image ||
    item.assets?.icon

  if (typeof candidate === 'string' && candidate.trim()) {
    if (/^https?:\/\//i.test(candidate)) return candidate

    return `${API_ORIGIN}${candidate.startsWith('/') ? '' : '/'}${candidate}`
  }

  return `${API_ORIGIN}/images/home/pets/${getPetSlug(item)}/normal.png`
}

const getCurrentLevel = (item) =>
  Number(item.currentLevel ?? item.level ?? 0)

const getMaxLevel = (item) =>
  Number(item.maxAllowedLevel ?? item.maxLevel ?? item.totalLevels ?? 0)

const getRemainingTime = (item) =>
  item.remainingTimeSeconds ??
  item.remainingSeconds ??
  item.upgradeTimeSeconds ??
  item.timeRemainingSeconds ??
  0

const getRemainingCost = (item) =>
  item.remainingCost ?? item.upgradeCost ?? item.cost ?? null

// Page background shown while a row is hovered
const BG_IMG_CLASS =
  'absolute right-[2%] top-1/2 h-[70vh] w-auto max-w-none -translate-y-1/2 object-contain transition-opacity duration-500'

const BG_MASK = {
  WebkitMaskImage: 'linear-gradient(to left, black 35%, transparent 95%)',
  maskImage: 'linear-gradient(to left, black 35%, transparent 95%)',
}

const Pets = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const state = location.state || {}
  const upgradeData = state.upgradeData || {}
  const villageData = state.villageData || {}

  const playerTag =
    state.playerTag || villageData.playerTag || villageData.tag || ''

  const [search, setSearch] = useState('')

  // Hover background: hovering a row shows its image as the page background
  const [bgSeen, setBgSeen] = useState([]) // hovered images (mounted lazily)
  const [activeBg, setActiveBg] = useState(null) // image currently shown

  const hoverBg = (src) => {
    if (!src) return
    setBgSeen((prev) => (prev.includes(src) ? prev : [...prev, src]))
    // wait two frames so a newly mounted image can fade in
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setActiveBg(src))
    )
  }

  const clearBg = () => setActiveBg(null)

  // Rows change with search / tab, so reset the hover state
  useEffect(() => {
    setActiveBg(null)
  }, [search])

  const allItems = Array.isArray(upgradeData.items)
    ? upgradeData.items
    : []

  const petItems = useMemo(
    () =>
      allItems.filter((item) => {
        const category = normalize(item.category)
        const group = normalize(item.group)
        const subcategory = normalize(item.subcategory)
        const sourceCategory = normalize(item.sourceCategory)

        return (
          category === 'pet' ||
          category === 'pets' ||
          group === 'pet' ||
          group === 'pets' ||
          subcategory === 'pets' ||
          sourceCategory === 'pet' ||
          sourceCategory === 'pets'
        )
      }),
    [allItems]
  )

  const visibleItems = useMemo(() => {
    const query = normalize(search)

    return petItems
      .filter(
        (item) =>
          !query || normalize(getItemName(item)).includes(query)
      )
      .sort((a, b) => getItemName(a).localeCompare(getItemName(b)))
  }, [petItems, search])

  const completedCount = petItems.filter((item) => {
    const current = getCurrentLevel(item)
    const max = getMaxLevel(item)
    return max > 0 && current >= max
  }).length

  const totalRemainingTime = petItems.reduce(
    (sum, item) => sum + Number(getRemainingTime(item) || 0),
    0
  )

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070914] px-4 py-8 text-white sm:px-8 lg:px-12">
      {/* Hover background artwork */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {bgSeen.map((src) => (
          <img
            key={src}
            src={src}
            alt=""
            aria-hidden="true"
            className={`${BG_IMG_CLASS} ${
              activeBg === src ? 'opacity-100' : 'opacity-0'
            }`}
            style={BG_MASK}
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
        ))}

        {/* Blend into the page background */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#070914]/80 via-[#070914]/25 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070914]/80 via-transparent to-[#070914]/35" />
      </div>

      <div className="ambient ambient-one pointer-events-none absolute" />
      <div className="ambient ambient-two pointer-events-none absolute" />

      <main className="relative z-10 mx-auto max-w-7xl">
        {/* Header */}
        <header className="mb-9 flex flex-wrap items-center justify-between gap-4">
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
            onClick={() =>
              navigate('/category', {
                state: {
                  playerTag,
                  currentTownHall: state.currentTownHall,
                  villageData,
                  upgradeData,
                },
              })
            }
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-cyan-400/50 hover:text-cyan-300"
          >
            <ArrowLeft size={16} />
            Categories
          </button>
        </header>

        {/* Banner */}
        <section className="relative mb-8 isolate overflow-hidden rounded-2xl border border-cyan-400/15 px-5 py-7 sm:px-8">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <img
              src={`${API_ORIGIN}/images/home/pets/unicorn/normal.png`}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center opacity-[0.16]"
              onError={(event) => {
                event.currentTarget.style.display = 'none'
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#070914]/90 via-[#070914]/75 to-[#070914]/90" />
          </div>

          <p className="text-xs font-bold tracking-[0.25em] text-cyan-300">
            PET PROGRESSION
          </p>

          <h2 className="mt-3 text-3xl font-black sm:text-4xl">
            Pets <span className="text-cyan-300">Overview.</span>
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Track pet levels, upgrade progress, remaining time, and resources
            needed to upgrade your companions.
          </p>
        </section>

        {/* Summary */}
        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="neon-panel rounded-xl border border-cyan-400/15 p-4">
            <p className="text-xs text-slate-500">Pets found</p>
            <p className="mt-2 text-2xl font-black text-cyan-300">
              {petItems.length}
            </p>
          </div>

          <div className="neon-panel rounded-xl border border-cyan-400/15 p-4">
            <p className="text-xs text-slate-500">Fully upgraded</p>
            <p className="mt-2 text-2xl font-black text-cyan-300">
              {completedCount}
            </p>
          </div>

          <div className="neon-panel rounded-xl border border-cyan-400/15 p-4">
            <p className="text-xs text-slate-500">Remaining upgrade time</p>
            <p className="mt-2 text-xl font-black text-cyan-300">
              {formatDuration(totalRemainingTime)}
            </p>
          </div>
        </section>

        {/* Inventory */}
        <section className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] text-cyan-300">
              PET INVENTORY
            </p>
            <h3 className="mt-2 text-2xl font-black">
              All Pets <span className="text-cyan-300">Items.</span>
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {visibleItems.length} pets found
              {visibleItems.length > 0 && ` · ${completedCount} fully upgraded`}
            </p>
          </div>

          <label className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 sm:max-w-xs">
            <Search size={16} className="text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search pets..."
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
            />
          </label>
        </section>

        {/* Pet rows */}
        {visibleItems.length > 0 ? (
          <section className="space-y-3">
            {visibleItems.map((item, index) => {
              const currentLevel = getCurrentLevel(item)
              const maxLevel = getMaxLevel(item)
              const isComplete = maxLevel > 0 && currentLevel >= maxLevel

              const progress =
                maxLevel > 0
                  ? Math.min(100, (currentLevel / maxLevel) * 100)
                  : 0

              const image = getPetImage(item)

              return (
                <article
                  key={
                    item.villageItemId ||
                    item.itemId ||
                    item.id ||
                    `${getItemName(item)}-${index}`
                  }
                  onMouseEnter={() => hoverBg(image)}
                  onMouseLeave={clearBg}
                  className="neon-panel relative isolate w-full overflow-hidden rounded-xl border border-white/10 px-4 py-3 transition duration-300 hover:border-cyan-400/40 sm:px-5"
                >
                  <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
                    <img
                      src={image}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover object-center opacity-[0.14]"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none'
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#070914]/90 via-[#070914]/85 to-[#070914]/75" />
                  </div>

                  <div className="relative z-10 grid grid-cols-1 items-center gap-4 md:grid-cols-[minmax(220px,1.2fr)_minmax(180px,1fr)_minmax(150px,0.8fr)_minmax(180px,1fr)]">
                    {/* Pet image and name */}
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-cyan-400/15 bg-black/20 p-1.5">
                        <img
                          src={image}
                          alt={getItemName(item)}
                          loading="lazy"
                          className="h-full w-full object-contain drop-shadow-[0_0_12px_rgba(34,211,238,0.18)]"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none'
                          }}
                        />
                      </div>

                      <div className="min-w-0">
                        <h4 className="truncate text-base font-extrabold text-white sm:text-lg">
                          {getItemName(item)}
                        </h4>
                        <p className="mt-1 text-xs text-slate-400">
                          Level{' '}
                          <span className="font-bold text-cyan-300">
                            {currentLevel}
                          </span>
                          {maxLevel > 0 && <> / {maxLevel}</>}
                        </p>

                        {isComplete && (
                          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                            <CheckCircle2 size={12} />
                            Fully upgraded
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="min-w-0">
                      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-500">Upgrade progress</span>
                        <span className="font-bold text-cyan-300">
                          {progress.toFixed(0)}%
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.25)] transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Remaining time */}
                    <div className="flex items-center gap-2 md:justify-center">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-400/[0.08] text-cyan-300">
                        <Clock3 size={16} />
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">Remaining time</p>
                        <p className="mt-0.5 text-sm font-bold text-cyan-300">
                          {formatDuration(getRemainingTime(item))}
                        </p>
                      </div>
                    </div>

                    {/* Remaining cost */}
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-400/[0.08] text-cyan-300">
                        <Coins size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-500">Remaining cost</p>
                        <p className="mt-0.5 break-words text-sm font-bold text-cyan-300">
                          {formatCosts(getRemainingCost(item))}
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </section>
        ) : (
          <div className="neon-panel rounded-2xl border border-white/10 px-5 py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06]">
              <PawPrint size={25} className="text-cyan-300" />
            </div>

            <h4 className="mt-4 text-lg font-bold text-white">
              {search ? 'No matching pets' : 'No pet data available'}
            </h4>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              {search
                ? 'Try another pet name or clear the search.'
                : 'No pet records were found in the current upgrade response.'}
            </p>

            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="mt-4 rounded-lg border border-cyan-400/20 px-4 py-2 text-sm text-cyan-300 transition hover:bg-cyan-400/10"
              >
                Clear search
              </button>
            )}
          </div>
        )}

        <footer className="py-8 text-center text-xs tracking-widest text-slate-600">
          COC BASE TRACKER
          <span className="mx-2 text-cyan-400">•</span>
          BUILD YOUR STRATEGY
        </footer>
      </main>
    </div>
  )
}

export default Pets