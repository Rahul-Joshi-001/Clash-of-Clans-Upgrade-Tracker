import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Castle, Wrench, Search, CheckCircle2 } from 'lucide-react'
import { BACKEND_URL as API_ORIGIN } from '../services/api'


const ORE_TYPES = [
  {
    key: 'shinyOre',
    name: 'Shiny Ore',
    image: `${API_ORIGIN}/images/shiny.webp`,
    color: 'text-cyan-300',
  },
  {
    key: 'glowyOre',
    name: 'Glowy Ore',
    image: `${API_ORIGIN}/images/glowy.jpeg`,
    color: 'text-purple-300',
  },
  {
    key: 'starryOre',
    name: 'Starry Ore',
    image: `${API_ORIGIN}/images/starry.jpg`,
    color: 'text-amber-300',
  },
]

const normalize = (value = '') =>
  String(value).toLowerCase().replace(/[\s_-]/g, '').trim()

const formatNumber = (value) =>
  Number(value || 0).toLocaleString('en-US')

const getItemName = (item) =>
  item.name || item.displayName || item.itemName || item.key || 'Equipment'

const toSlug = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const getEquipmentImage = (item) => {
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
    return `${API_ORIGIN}${candidate.startsWith('/') ? '' : '/'}${candidate}`
  }

  const slug = toSlug(item.slug || item.key || getItemName(item))
  return `${API_ORIGIN}/images/home/hero-equipment/${slug}/icon.png`
}

const getCurrentLevel = (item) =>
  Number(item.currentLevel ?? item.level ?? 0)

const getMaxLevel = (item) =>
  Number(item.maxAllowedLevel ?? item.maxLevel ?? item.totalLevels ?? 0)

// Map any ore-like name (SHINY_ORE, "Shiny Ore", shinyOre, shiny...) to a key
const getOreKey = (value = '') => {
  const name = normalize(value)
  if (name.includes('shiny') || name === 'ore' || name === 'ore1') return 'shinyOre'
  if (name.includes('glowy') || name === 'ore2') return 'glowyOre'
  if (name.includes('starry') || name === 'ore3') return 'starryOre'
  return null
}

const emptyOres = () => ({ shinyOre: 0, glowyOre: 0, starryOre: 0 })
const hasOres = (totals) => Object.values(totals).some((v) => v > 0)

// Reads one record that may look like { resource: 'SHINY_ORE', cost: 100 }
// or { SHINY_ORE: 100 } or { shinyOre: 100 }
const addFromRecord = (totals, record) => {
  if (!record || typeof record !== 'object') return

  const resourceName =
    record.resource ?? record.costResource ?? record.COST_RESOURCE ?? record.type
  const resourceKey = getOreKey(resourceName)
  const amount = Number(
    record.totalCost ?? record.cost ?? record.amount ?? record.UPGRADE_COST ?? 0
  )

  if (resourceKey) {
    totals[resourceKey] += amount
    return
  }

  // Keys that are themselves ore names
  Object.entries(record).forEach(([key, value]) => {
    const oreKey = getOreKey(key)
    if (oreKey && typeof value !== 'object') totals[oreKey] += Number(value ?? 0)
  })
}

const getOreTotals = (item) => {
  // 0. Totals computed by the backend
  if (item.ores && hasOres({ ...emptyOres(), ...item.ores })) {
    return { ...emptyOres(), ...item.ores }
  }

  // 1. Per-level upgrades
  const fromUpgrades = emptyOres()
  if (Array.isArray(item.upgrades)) {
    item.upgrades.forEach((upgrade) => addFromRecord(fromUpgrades, upgrade))
  }
  if (hasOres(fromUpgrades)) return fromUpgrades

  // 2. remainingCost: { SHINY_ORE: 1200, ... }
  const fromRemaining = emptyOres()
  if (item.remainingCost && typeof item.remainingCost === 'object') {
    addFromRecord(fromRemaining, item.remainingCost)
  }
  if (hasOres(fromRemaining)) return fromRemaining

  // 3. Fields directly on the item
  const fromItem = emptyOres()
  addFromRecord(fromItem, item)
  return fromItem
}

// Page background shown while an equipment row is hovered (smaller than Buildings)
const BG_IMG_CLASS =
  'absolute right-[2%] top-1/2 h-[70vh] w-auto max-w-none -translate-y-1/2 object-contain transition-opacity duration-500'

const BG_MASK = {
  WebkitMaskImage: 'linear-gradient(to left, black 35%, transparent 95%)',
  maskImage: 'linear-gradient(to left, black 35%, transparent 95%)',
}

const Equipment = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const state = location.state || {}
  const upgradeData = state.upgradeData || {}
  const villageData = state.villageData || {}

  const playerTag =
    state.playerTag || villageData.playerTag || villageData.tag || ''

  const [search, setSearch] = useState('')

  // Hover background: hovering a row shows that equipment as the page background
  const [bgSeen, setBgSeen] = useState([]) // hovered images (mounted lazily)
  const [activeBg, setActiveBg] = useState(null) // image currently shown

  const hoverBg = (src) => {
    setBgSeen((prev) => (prev.includes(src) ? prev : [...prev, src]))
    // wait two frames so a newly mounted image can fade in
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setActiveBg(src))
    )
  }

  const clearBg = () => setActiveBg(null)

  // Rows disappear when searching, so reset the hover state
  useEffect(() => {
    setActiveBg(null)
  }, [search])

  const allItems = Array.isArray(upgradeData.items)
    ? upgradeData.items
    : []

  const equipmentItems = useMemo(
    () =>
      allItems.filter((item) => {
        const category = normalize(item.category)
        const group = normalize(item.group)
        const sourceCategory = normalize(item.sourceCategory)

        return (
          category.includes('equipment') ||
          group === 'equipment' ||
          sourceCategory === 'heroequipment' ||
          sourceCategory === 'equipment'
        )
      }),
    [allItems]
  )

  const visibleItems = useMemo(() => {
    const query = normalize(search)

    return equipmentItems
      .filter(
        (item) =>
          !query || normalize(getItemName(item)).includes(query)
      )
      .sort((a, b) => getItemName(a).localeCompare(getItemName(b)))
  }, [equipmentItems, search])

  const completedCount = visibleItems.filter((item) => {
    const currentLevel = getCurrentLevel(item)
    const maxLevel = getMaxLevel(item)
    return maxLevel > 0 && currentLevel >= maxLevel
  }).length

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
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-300"
          >
            <ArrowLeft size={16} />
            Categories
          </button>
        </header>

        {/* Page heading */}
        <section className="mb-8">
          <p className="text-xs font-bold tracking-[0.25em] text-amber-300">
            HERO PROGRESSION
          </p>

          <h2 className="mt-3 text-3xl font-black sm:text-4xl">
            Hero Equipment <span className="neon-text">Overview.</span>
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Track equipment levels and the ores required for your remaining upgrades.
          </p>
        </section>

        {/* Search and count */}
        <section className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] text-amber-300">
              EQUIPMENT INVENTORY
            </p>

            <h3 className="mt-2 text-2xl font-black">
              All Equipment <span className="neon-text">Items.</span>
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {visibleItems.length} items found
              {visibleItems.length > 0 && ` · ${completedCount} fully upgraded`}
            </p>
          </div>

          <label className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 sm:max-w-xs">
            <Search size={16} className="text-slate-500" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search equipment..."
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
            />
          </label>
        </section>

        {/* Full-width equipment rows */}
        {visibleItems.length > 0 ? (
          <section className="space-y-3">
            {visibleItems.map((item, index) => {
              const currentLevel = getCurrentLevel(item)
              const maxLevel = getMaxLevel(item)
              const isComplete =
                maxLevel > 0 && currentLevel >= maxLevel

              const progress =
                maxLevel > 0
                  ? Math.min(100, (currentLevel / maxLevel) * 100)
                  : 0

              const ores = getOreTotals(item)
              const image = getEquipmentImage(item)

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
                  className="neon-panel relative isolate w-full overflow-hidden rounded-xl border border-white/10 px-4 py-4 transition duration-300 hover:border-cyan-400/30 sm:px-5"
                >
                  {/* Blended background artwork */}
                  <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
                    <img
                      src={image}
                      alt=""
                      aria-hidden="true"
                      className="absolute left-0 top-1/2 h-[220%] w-auto max-w-none -translate-y-1/2 object-contain opacity-[0.22]"
                      style={{
                        WebkitMaskImage:
                          'linear-gradient(to right, black 0%, transparent 55%)',
                        maskImage:
                          'linear-gradient(to right, black 0%, transparent 55%)',
                      }}
                      onError={(event) => {
                        event.currentTarget.style.display = 'none'
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#070914]/40 via-[#070914]/80 to-[#070914]/95" />
                  </div>

                  <div className="relative z-10 grid grid-cols-1 items-center gap-5 md:grid-cols-[minmax(210px,1.1fr)_minmax(150px,0.7fr)_minmax(0,1.5fr)]">
                    {/* Equipment image and name */}
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/20 p-2">
                        <img
                          src={image}
                          alt={getItemName(item)}
                          loading="lazy"
                          className="h-full w-full object-contain"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none'
                          }}
                        />
                      </div>

                      <div className="min-w-0">
                        <h4 className="text-base font-extrabold text-white sm:text-lg">
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
                        <span className="text-slate-500">Progress</span>
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

                    {/* Ores: no cards, borders, or backgrounds */}
                    <div className="min-w-0">
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                        Required Ores
                      </p>

                      <div className="grid grid-cols-3 gap-3">
                        {ORE_TYPES.map((ore) => (
                          <div
                            key={ore.key}
                            className="flex min-w-0 items-center gap-1.5 sm:gap-2"
                          >
                            <img
                              src={ore.image}
                              alt={ore.name}
                              title={ore.name}
                              className="h-8 w-8 shrink-0 rounded-full object-cover opacity-90 sm:h-10 sm:w-10"
                              style={{
                                WebkitMaskImage:
                                  'radial-gradient(circle, black 55%, transparent 72%)',
                                maskImage:
                                  'radial-gradient(circle, black 55%, transparent 72%)',
                              }}
                              onError={(event) => {
                                event.currentTarget.style.display = 'none'
                              }}
                            />

                            <div className="min-w-0">
                              <p className={`text-sm font-extrabold sm:text-base ${ore.color}`}>
                                {formatNumber(ores[ore.key])}
                              </p>
                              <p className="text-[10px] leading-4 text-slate-500 sm:text-xs">
                                {ore.name}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </section>
        ) : (
          <div className="neon-panel rounded-2xl border border-white/10 px-5 py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/[0.06]">
              <Wrench size={25} className="text-amber-300" />
            </div>

            <h4 className="mt-4 text-lg font-bold text-white">
              {search ? 'No matching equipment' : 'No equipment data available'}
            </h4>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              {search
                ? 'Try another equipment name or clear the search.'
                : 'No equipment items were found in the current upgrade response.'}
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
          COC BASE TRACKER <span className="mx-2 text-cyan-500">•</span>
          BUILD YOUR STRATEGY
        </footer>
      </main>
    </div>
  )
}

export default Equipment