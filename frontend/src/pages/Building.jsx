import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Castle,
  Shield,
  Building2,
  Bomb,
  Clock3,
  Coins,
  CheckCircle2,
  Search,
} from 'lucide-react'

const API_ORIGIN = 'http://localhost:3000'

const SUBCATEGORIES = [
  {
    id: 'DEFENSIVE',
    name: 'Defensive',
    subtitle: 'Defensive structures',
    image: '/images/home/defenses/eagle-artillery/normal/level-1.png',
    accent: 'text-cyan-300',
    border: 'hover:border-cyan-400/50',
    active: 'border-cyan-400/60 bg-cyan-400/[0.08]',
  },
  {
    id: 'NORMAL',
    name: 'Normal',
    subtitle: 'Army, resource & other buildings',
    image: '/images/home/army-buildings/laboratory/normal/level-1.png',
    accent: 'text-purple-300',
    border: 'hover:border-purple-400/50',
    active: 'border-purple-400/60 bg-purple-400/[0.08]',
  },
  {
    id: 'TRAP',
    name: 'Traps',
    subtitle: 'Hidden defenses & traps',
    image: '/images/home/defenses/wall/normal/level-1.png',
    accent: 'text-amber-300',
    border: 'hover:border-amber-400/50',
    active: 'border-amber-400/60 bg-amber-400/[0.08]',
  },
]

const normalize = (value = '') =>
  String(value).toLowerCase().replace(/[\s_-]/g, '').trim()

const formatNumber = (value) =>
  Number(value || 0).toLocaleString('en-US')

const formatDuration = (seconds = 0) => {
  let remaining = Math.max(0, Math.round(Number(seconds) || 0))
  const days = Math.floor(remaining / 86400)
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
          `${formatNumber(amount)} ${resource}`
        )
        .join(' · ')
    : 'No remaining cost'
}

const DEFENSIVE_NAMES = new Set([
  'airdefense',
  'archertower',
  'cannons',
  'cannon',
  'mortars',
  'mortar',
  'wizardtower',
  'wizardtowers',
  'airsweeper',
  'hiddentesla',
  'xbow',
  'xbows',
  'infernotower',
  'infernotowers',
  'bombtower',
  'bombtowers',
  'scattershot',
  'scattershots',
  'eagleartillery',
  'monolith',
  'spelltower',
  'ricochetcannon',
  'ricochetcannons',
  'multiarc',
  'multiarchertower',
  'firespitter',
  'firespitters',
  'builderhut',
  'builderhutdefense',
  'revengetower',
  'fusedinferno',
])

const TRAP_NAMES = new Set([
  'airbomb',
  'airbombs',
  'bomb',
  'bombs',
  'giantbomb',
  'giantbombs',
  'springtrap',
  'springtraps',
  'seekingairmine',
  'seekingairmines',
  'skeletontrap',
  'skeletontraps',
  'tornadotrap',
  'tornadotraps',
  'smallbomb',
  'smallbombs',
  'pushtrap',
  'pushtraps',
  'loglaunchertrap',
  'builderbasebomb',
  'builderbasegiantcannon',
  'giantcannontrap',
])

const getItemName = (item) =>
  item.name ||
  item.displayName ||
  item.itemName ||
  item.key ||
  'Building'

const getSubcategory = (item) => {
  const raw = normalize(
    item.subcategory ||
      item.subCategory ||
      item.group ||
      item.sourceCategory ||
      ''
  )

  const category = normalize(item.category || '')
  const name = normalize(getItemName(item))

  if (
    raw.includes('trap') ||
    category.includes('trap') ||
    TRAP_NAMES.has(name)
  ) {
    return 'TRAP'
  }

  if (
    raw.includes('defensive') ||
    raw.includes('defense') ||
    category.includes('defense') ||
    DEFENSIVE_NAMES.has(name)
  ) {
    return 'DEFENSIVE'
  }

  if (
    raw.includes('normal') ||
    [
      'armybuilding',
      'resourcebuilding',
      'otherbuilding',
      'building',
      'buildings',
    ].includes(category)
  ) {
    return 'NORMAL'
  }

  return null
}

const toSlug = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const getItemImage = (item, subcategory) => {
  const candidate =
    item.imageUrl ||
    item.imageURL ||
    item.imagePath ||
    item.image_path ||
    item.image ||
    item.iconUrl ||
    item.iconPath ||
    item.icon_path ||
    item.icon ||
    item.assets?.image ||
    item.assets?.icon

  if (typeof candidate === 'string' && candidate.trim()) {
    if (/^https?:\/\//i.test(candidate)) return candidate

    return `${API_ORIGIN}${
      candidate.startsWith('/') ? '' : '/'
    }${candidate}`
  }

  const slug = toSlug(item.slug || item.key || getItemName(item))

  const folder =
    subcategory === 'DEFENSIVE'
      ? 'defenses'
      : subcategory === 'TRAP'
        ? 'traps'
        : 'army-buildings'

  return `${API_ORIGIN}/images/home/${folder}/${slug}/normal/level-1.png`
}

const BG_IMG_CLASS =
  'absolute right-[2%] top-1/2 h-[90vh] w-auto max-w-none -translate-y-1/2 object-contain transition-opacity duration-500'

const BG_MASK = {
  WebkitMaskImage: 'linear-gradient(to left, black 30%, transparent 95%)',
  maskImage: 'linear-gradient(to left, black 30%, transparent 95%)',
}

const Building = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const state = location.state || {}
  const upgradeData = state.upgradeData || {}
  const villageData = state.villageData || {}

  const playerTag =
    state.playerTag ||
    villageData.playerTag ||
    villageData.tag ||
    ''

  const [selectedSubcategory, setSelectedSubcategory] =
    useState('DEFENSIVE')

  const [search, setSearch] = useState('')

  // Hover background: hovering a building row swaps the page background
  const [bgSeen, setBgSeen] = useState([]) // images that were hovered (mounted lazily)
  const [activeBg, setActiveBg] = useState(null) // image currently shown
  const [bgFailed, setBgFailed] = useState([]) // images that failed to load

  const hoverBg = (src) => {
    setBgSeen((prev) => (prev.includes(src) ? prev : [...prev, src]))
    // wait two frames so a newly mounted image can fade in
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setActiveBg(src))
    )
  }

  const clearBg = () => setActiveBg(null)

  // Rows disappear when the group or search changes, so reset the hover state
  useEffect(() => {
    setActiveBg(null)
  }, [selectedSubcategory, search])

  const hoverActive = Boolean(activeBg) && !bgFailed.includes(activeBg)

  const allItems = Array.isArray(upgradeData.items)
    ? upgradeData.items
    : []

  const buildingItems = useMemo(
    () =>
      allItems.filter((item) => {
        const category = normalize(item.category)

        return (
          [
            'building',
            'buildings',
            'defense',
            'defenses',
            'trap',
            'traps',
          ].includes(category) ||
          getSubcategory(item) !== null
        )
      }),
    [allItems]
  )

  const visibleItems = useMemo(() => {
    const query = normalize(search)

    return buildingItems
      .filter(
        (item) =>
          getSubcategory(item) === selectedSubcategory
      )
      .filter(
        (item) =>
          !query ||
          normalize(getItemName(item)).includes(query)
      )
      .sort((a, b) =>
        getItemName(a).localeCompare(getItemName(b))
      )
  }, [buildingItems, selectedSubcategory, search])

  // Group records for the same building at the same level.
  // Different levels remain separate rows.
  const groupedVisibleItems = useMemo(() => {
    const groups = new Map()

    visibleItems.forEach((item) => {
      const key = JSON.stringify([
        normalize(getItemName(item)),
        Number(item.currentLevel ?? item.level ?? 0),
        Number(
          item.maxAllowedLevel ??
            item.maxLevel ??
            item.totalLevels ??
            0
        ),
        item.remainingTimeSeconds ??
          item.remainingSeconds ??
          item.upgradeTimeSeconds ??
          item.timeRemainingSeconds ??
          0,
        item.remainingCost ??
          item.upgradeCost ??
          item.cost ??
          null,
      ])

      if (!groups.has(key)) {
        groups.set(key, { ...item, quantity: 1 })
      } else {
        groups.get(key).quantity += 1
      }
    })

    return Array.from(groups.values()).sort((a, b) => {
      const nameOrder = getItemName(a).localeCompare(getItemName(b))

      if (nameOrder !== 0) return nameOrder

      return (
        Number(a.currentLevel ?? a.level ?? 0) -
        Number(b.currentLevel ?? b.level ?? 0)
      )
    })
  }, [visibleItems])

  const selectedConfig = SUBCATEGORIES.find(
    (category) => category.id === selectedSubcategory
  )

  const completedCount = visibleItems.filter((item) => {
    const maxLevel = Number(
      item.maxAllowedLevel || item.maxLevel || 0
    )

    return (
      maxLevel > 0 &&
      Number(item.currentLevel || 0) >= maxLevel
    )
  }).length

  const getCurrentLevel = (item) =>
    Number(item.currentLevel ?? item.level ?? 0)

  const getMaxLevel = (item) =>
    Number(
      item.maxAllowedLevel ??
        item.maxLevel ??
        item.totalLevels ??
        0
    )

  const getRemainingTime = (item) =>
    item.remainingTimeSeconds ??
    item.remainingSeconds ??
    item.upgradeTimeSeconds ??
    item.timeRemainingSeconds ??
    0

  const getRemainingCost = (item) =>
    item.remainingCost ??
    item.upgradeCost ??
    item.cost ??
    null

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070914] px-4 py-8 text-white sm:px-8 lg:px-12">
      {/* Page background artwork: changes with the selected group
          Defensive -> Eagle Artillery, Normal -> Laboratory, Traps -> trap image */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Group images (shown when no row is hovered) */}
        {SUBCATEGORIES.map((category) => (
          <img
            key={category.id}
            src={`${API_ORIGIN}${category.image}`}
            alt=""
            aria-hidden="true"
            className={`${BG_IMG_CLASS} ${
              selectedSubcategory === category.id && !hoverActive
                ? 'opacity-100'
                : 'opacity-0'
            }`}
            style={BG_MASK}
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
        ))}

        {/* Hovered building images */}
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
            onError={() =>
              setBgFailed((prev) =>
                prev.includes(src) ? prev : [...prev, src]
              )
            }
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
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-300"
          >
            <ArrowLeft size={16} />
            Categories
          </button>
        </header>

        {/* Page title */}
        <section className="mb-8">
          <p className="text-xs font-bold tracking-[0.25em] text-cyan-400">
            BUILDING MANAGEMENT
          </p>

          <h2 className="mt-3 text-3xl font-black sm:text-4xl">
            Buildings <span className="neon-text">Overview.</span>
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Choose a building group to explore upgrade levels,
            remaining time, and costs.
          </p>
        </section>

        {/* Three subcategory cards */}
        <section className="mb-9 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {SUBCATEGORIES.map((category) => {
            const isActive =
              selectedSubcategory === category.id

            const count = buildingItems.filter(
              (item) =>
                getSubcategory(item) === category.id
            ).length

            return (
              <button
                key={category.id}
                type="button"
                onClick={() =>
                  setSelectedSubcategory(category.id)
                }
                className={`neon-panel group relative isolate min-h-40 overflow-hidden rounded-2xl border p-5 text-left transition duration-300 hover:-translate-y-1 ${
                  isActive
                    ? category.active
                    : `border-white/10 ${category.border}`
                }`}
              >
                <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
                  <img
                    src={`${API_ORIGIN}${category.image}`}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full object-cover object-center opacity-25 transition duration-500 group-hover:opacity-35"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none'
                    }}
                  />

                  <div className="absolute inset-0 bg-gradient-to-r from-[#070914]/95 via-[#070914]/75 to-[#070914]/35" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#070914]/70 to-transparent" />
                </div>

                <div className="relative z-10 flex h-full min-h-28 items-center justify-between gap-3">
                  <div>
                    <p className={`text-xs font-bold tracking-[0.2em] ${category.accent}`}>
                      BUILDING GROUP
                    </p>

                    <h3 className="mt-2 text-2xl font-black">
                      {category.name}
                    </h3>

                    <p className="mt-1 text-xs text-slate-400">
                      {category.subtitle}
                    </p>

                    <p className="mt-4 text-xs text-slate-300">
                      {count} {count === 1 ? 'item' : 'items'}
                    </p>
                  </div>

                  <img
                    src={`${API_ORIGIN}${category.image}`}
                    alt={category.name}
                    loading="lazy"
                    className="h-24 w-24 shrink-0 object-contain opacity-100 drop-shadow-[0_0_18px_rgba(34,211,238,0.12)] transition duration-300 group-hover:scale-110 sm:h-28 sm:w-28"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none'
                    }}
                  />
                </div>

                {isActive && (
                  <span className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/30 px-2 py-1 text-[10px] font-bold text-white">
                    SELECTED
                  </span>
                )}
              </button>
            )
          })}
        </section>

        {/* Selected group and search */}
        <section className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className={`text-xs font-bold tracking-[0.25em] ${selectedConfig?.accent}`}>
              SELECTED GROUP
            </p>

            <h3 className="mt-2 text-2xl font-black">
              {selectedConfig?.name}{' '}
              <span className="neon-text">Buildings.</span>
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {visibleItems.length} buildings total · {groupedVisibleItems.length} unique name/level groups
              {visibleItems.length > 0 &&
                ` · ${completedCount} fully upgraded`}
            </p>
          </div>

          <label className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 sm:max-w-xs">
            <Search size={16} className="text-slate-500" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${selectedConfig?.name.toLowerCase()}...`}
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
            />
          </label>
        </section>

        {/* Compact full-width building rows */}
        {groupedVisibleItems.length > 0 ? (
          <section className="space-y-3">
            {groupedVisibleItems.map((item, index) => {
              const currentLevel = getCurrentLevel(item)
              const maxLevel = getMaxLevel(item)
              const isComplete =
                maxLevel > 0 && currentLevel >= maxLevel

              const image = getItemImage(
                item,
                selectedSubcategory
              )

              const progress =
                maxLevel > 0
                  ? Math.min(
                      100,
                      (currentLevel / maxLevel) * 100
                    )
                  : 0

              return (
                <article
                  key={`${normalize(getItemName(item))}-${currentLevel}-${maxLevel}-${index}`}
                  onMouseEnter={() => hoverBg(image)}
                  onMouseLeave={clearBg}
                  onFocus={() => hoverBg(image)}
                  onBlur={clearBg}
                  className="neon-panel relative isolate w-full overflow-hidden rounded-xl border border-white/10 px-4 py-3 transition duration-300 hover:border-cyan-400/30 sm:px-5"
                >
                  <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
                    <img
                      src={image}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 h-full w-full object-cover object-center opacity-15"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none'
                      }}
                    />

                    <div className="absolute inset-0 bg-gradient-to-r from-[#070914]/95 via-[#070914]/90 to-[#070914]/75" />
                  </div>

                  <div className="relative z-10 grid grid-cols-1 items-center gap-4 md:grid-cols-[minmax(220px,1.2fr)_minmax(180px,1fr)_minmax(150px,0.8fr)_minmax(180px,1fr)]">
                    {/* Building image and level */}
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/20 p-1.5">
                        <img
                          src={image}
                          alt={getItemName(item)}
                          loading="lazy"
                          className="h-full w-full object-contain"
                          onError={(event) => {
                            const imageElement = event.currentTarget

                            if (!imageElement.dataset.fallbackTried) {
                              imageElement.dataset.fallbackTried = 'true'
                              imageElement.src = `${API_ORIGIN}${selectedConfig?.image || ''}`
                            } else {
                              imageElement.style.display = 'none'
                            }
                          }}
                        />
                      </div>

                      <div className="min-w-0">
                        <h4 className="truncate text-base font-extrabold text-white sm:text-lg">
                          {item.quantity > 1 && (
                            <span className="mr-2 text-cyan-300">
                              ×{item.quantity}
                            </span>
                          )}

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

                    {/* Level progress */}
                    <div className="min-w-0">
                      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-500">
                          Upgrade progress
                        </span>

                        <span className="font-bold text-cyan-300">
                          {progress.toFixed(0)}%
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-cyan-300 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Remaining time */}
                    <div className="flex items-center gap-2 md:justify-center">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-400/[0.08] text-purple-300">
                        <Clock3 size={16} />
                      </div>

                      <div>
                        <p className="text-[11px] text-slate-500">
                          Remaining time
                        </p>

                        <p className="mt-0.5 text-sm font-bold text-purple-300">
                          {formatDuration(
                            getRemainingTime(item)
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Remaining cost */}
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-400/[0.08] text-cyan-300">
                        <Coins size={16} />
                      </div>

                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-500">
                          Remaining cost
                        </p>

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
              {selectedSubcategory === 'TRAP' ? (
                <Bomb size={25} className="text-amber-300" />
              ) : selectedSubcategory === 'DEFENSIVE' ? (
                <Shield size={25} className="text-cyan-300" />
              ) : (
                <Building2 size={25} className="text-purple-300" />
              )}
            </div>

            <h4 className="mt-4 text-lg font-bold text-white">
              {search
                ? 'No matching buildings'
                : 'No building data available'}
            </h4>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              {search
                ? 'Try another building name or clear the search.'
                : 'No items matched this group in the current upgrade response. The backend must return all building records for the selected Town Hall to show a complete list.'}
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
          COC BASE TRACKER{' '}
          <span className="mx-2 text-cyan-500">•</span>
          BUILD YOUR STRATEGY
        </footer>
      </main>
    </div>
  )
}

export default Building