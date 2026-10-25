import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  Shield,
  Layers,
  Coins,
  CheckCircle2,
} from "lucide-react";

const API_ORIGIN = "http://localhost:3000";

const getCurrentLevel = (item) =>
  Number(item?.currentLevel ?? item?.current_level ?? item?.level ?? 0);

const getMaxLevel = (item) =>
  Number(item?.maxAllowedLevel ?? item?.maxLevel ?? item?.max_level ?? 0);

const getCost = (item) =>
  item?.remainingCost ??
  item?.remaining_cost ??
  item?.upgradeCost ??
  item?.upgrade_cost ??
  item?.cost ??
  item?.nextUpgradeCost ??
  null;

const getQuantity = (item) =>
  Number(item?.quantity ?? item?.count ?? 1);

const formatNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("en-US").format(number)
    : String(value ?? "");
};

const normalize = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[\s_-]/g, "");

const isWall = (item) => {
  const name = normalize(
    item?.name ?? item?.buildingName ?? item?.itemName ?? ""
  );
  const category = normalize(item?.category ?? item?.subcategory ?? "");

  return (
    name === "wall" ||
    name === "walls" ||
    name.startsWith("walllevel") ||
    category === "wall" ||
    category === "walls"
  );
};

// Wall art is selected using the wall's actual level.
const getWallImage = (level) =>
  `${API_ORIGIN}/images/home/defenses/wall/normal/level-${level}.png`;

const getResourceType = (name) => {
  const value = normalize(name);

  if (value.includes("gold")) return "gold";
  if (value.includes("elixir") && !value.includes("dark")) return "elixir";
  if (value.includes("darkelixir")) return "darkElixir";

  return null;
};

const getResourceImage = (resource) => {
  const paths = {
    gold: "/images/home/resources/gold.png",
    elixir: "/images/home/resources/elixir.png",
    darkElixir: "/images/home/resources/dark-elixir.png",
  };

  return `${API_ORIGIN}${paths[resource]}`;
};

const getCostEntries = (cost) => {
  if (cost == null || cost === "") return [];

  if (typeof cost === "number") {
    return [{ resource: "gold", amount: cost }];
  }

  if (typeof cost === "string") {
    const number = Number(cost);
    return Number.isFinite(number)
      ? [{ resource: "gold", amount: number }]
      : [];
  }

  if (typeof cost === "object" && !Array.isArray(cost)) {
    return Object.entries(cost)
      .map(([name, amount]) => ({
        resource: getResourceType(name),
        name,
        amount: Number(amount),
      }))
      .filter(
        (entry) =>
          entry.amount > 0 && Number.isFinite(entry.amount)
      );
  }

  return [];
};

// Page background shown while a wall row is hovered
const BG_IMG_CLASS =
  "absolute right-[2%] top-1/2 h-[70vh] w-auto max-w-none -translate-y-1/2 object-contain transition-opacity duration-500";

const BG_MASK = {
  WebkitMaskImage: "linear-gradient(to left, black 35%, transparent 95%)",
  maskImage: "linear-gradient(to left, black 35%, transparent 95%)",
};

export default function Walls() {
  const location = useLocation();
  const navigate = useNavigate();

  const upgradeData = location.state?.upgradeData;

  const [search, setSearch] = useState("");
  const [failedImages, setFailedImages] = useState({});

  // Hover background: hovering a row shows that wall level as the page background
  const [bgSeen, setBgSeen] = useState([]); // hovered images (mounted lazily)
  const [activeBg, setActiveBg] = useState(null); // image currently shown

  const hoverBg = (src) => {
    setBgSeen((prev) => (prev.includes(src) ? prev : [...prev, src]));
    // wait two frames so a newly mounted image can fade in
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setActiveBg(src))
    );
  };

  const clearBg = () => setActiveBg(null);

  // Rows change when searching, so reset the hover state
  useEffect(() => {
    setActiveBg(null);
  }, [search]);

  const wallItems = useMemo(() => {
    const items = Array.isArray(upgradeData?.items)
      ? upgradeData.items
      : [];

    return items.filter(isWall);
  }, [upgradeData]);

  const filteredWalls = useMemo(() => {
    const query = normalize(search);

    return wallItems
      .filter((item) => {
        const level = getCurrentLevel(item);

        return (
          !query ||
          normalize(`wall level ${level}`).includes(query) ||
          normalize(item?.name).includes(query) ||
          String(level).includes(query)
        );
      })
      .sort((a, b) => getCurrentLevel(a) - getCurrentLevel(b));
  }, [wallItems, search]);

  const groupedWalls = useMemo(() => {
    const groups = new Map();

    filteredWalls.forEach((item) => {
      const current = getCurrentLevel(item);
      const max = getMaxLevel(item);
      const cost = getCost(item);
      const key = `${current}-${max}-${JSON.stringify(cost)}`;

      if (groups.has(key)) {
        groups.get(key).quantity += getQuantity(item);
      } else {
        groups.set(key, {
          ...item,
          quantity: getQuantity(item),
        });
      }
    });

    return Array.from(groups.values());
  }, [filteredWalls]);

  const totalWalls = wallItems.reduce(
    (total, item) => total + getQuantity(item),
    0
  );

  const completedWalls = wallItems.reduce((total, item) => {
    const current = getCurrentLevel(item);
    const max = getMaxLevel(item);

    return total + (max > 0 && current >= max ? getQuantity(item) : 0);
  }, 0);

  const completion =
    totalWalls > 0
      ? Math.round((completedWalls / totalWalls) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100">
      {/* Hover background artwork */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {bgSeen.map((src) => (
          <img
            key={src}
            src={src}
            alt=""
            aria-hidden="true"
            className={`${BG_IMG_CLASS} ${
              activeBg === src ? "opacity-100" : "opacity-0"
            }`}
            style={BG_MASK}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ))}

        {/* Blend into the page background */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#070b14]/80 via-[#070b14]/25 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070b14]/80 via-transparent to-[#070b14]/35" />
      </div>

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-blue-600/10 blur-[120px]" />
      </div>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-300"
          >
            <ArrowLeft size={17} />
            Back
          </button>

          <div className="flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[0.07] px-3 py-1.5 text-xs font-medium text-cyan-300">
            <Shield size={14} />
            WALL MANAGEMENT
          </div>
        </div>

        <section className="mb-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10">
              <Shield size={30} className="text-cyan-300" />
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-400">
                Village upgrades
              </p>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Walls
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Track wall levels and upgrade costs.
              </p>
            </div>
          </div>
        </section>

        {/* Summary cards */}
        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-[#0c1321]/90 p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-slate-400">Total walls</span>
              <Layers size={19} className="text-cyan-300" />
            </div>
            <p className="text-3xl font-bold">{formatNumber(totalWalls)}</p>
            <p className="mt-2 text-xs text-slate-500">
              Walls in your village data
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0c1321]/90 p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-slate-400">Max-level walls</span>
              <CheckCircle2 size={19} className="text-emerald-400" />
            </div>
            <p className="text-3xl font-bold">
              {formatNumber(completedWalls)}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Walls at their recorded maximum level
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0c1321]/90 p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-slate-400">Completion</span>
              <Shield size={19} className="text-cyan-300" />
            </div>
            <p className="text-3xl font-bold">{completion}%</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-400"
                style={{ width: `${completion}%` }}
              />
            </div>
          </div>
        </section>

        {/* Wall list (more transparent so the hover background shows through) */}
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1321]/55">
          <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Wall upgrades</h2>
              <p className="mt-1 text-sm text-slate-400">
                {filteredWalls.length} matching records
              </p>
            </div>

            <div className="relative w-full sm:max-w-xs">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search wall level..."
                className="w-full rounded-xl border border-white/10 bg-[#070b14] py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
              />
            </div>
          </div>

          {groupedWalls.length > 0 ? (
            <div className="divide-y divide-white/[0.06]">
              {groupedWalls.map((wall, index) => {
                const current = getCurrentLevel(wall);
                const max = getMaxLevel(wall);
                const atMax = max > 0 && current >= max;
                const progress =
                  max > 0
                    ? Math.min(100, Math.round((current / max) * 100))
                    : 0;

                const costEntries = getCostEntries(getCost(wall));

                return (
                  <article
                    key={`${current}-${max}-${index}`}
                    onMouseEnter={() => hoverBg(getWallImage(current))}
                    onMouseLeave={clearBg}
                    className="flex flex-col gap-4 p-5 transition hover:bg-cyan-400/[0.025] sm:flex-row sm:items-center"
                  >
                    {/* Actual wall-level image */}
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
                      {!failedImages[`wall-${current}`] ? (
                        <img
                          src={getWallImage(current)}
                          alt={`Wall level ${current}`}
                          className="h-full w-full object-contain p-2"
                          onError={() =>
                            setFailedImages((prev) => ({
                              ...prev,
                              [`wall-${current}`]: true,
                            }))
                          }
                        />
                      ) : (
                        <Shield size={34} className="text-cyan-300" />
                      )}
                    </div>

                    {/* Level and progress */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-white">
                          Wall Level {current}
                        </h3>

                        {wall.quantity > 1 && (
                          <span className="rounded-md border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-xs text-cyan-300">
                            × {formatNumber(wall.quantity)}
                          </span>
                        )}

                        {atMax && (
                          <span className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-300">
                            Max level
                          </span>
                        )}
                      </div>

                      <p className="mb-3 text-xs text-slate-500">
                        Current level: {current}
                        {max > 0 ? ` / ${max}` : ""}
                      </p>

                      <div className="flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-400"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-cyan-300">
                          {progress}%
                        </span>
                      </div>
                    </div>

                    {/* Resource icon and upgrade cost */}
                    <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4 sm:min-w-52 sm:max-w-72">
                      <div className="mb-3 flex items-center gap-2 text-xs text-slate-400">
                        <Coins size={15} className="text-amber-300" />
                        {atMax ? "Upgrade status" : "Upgrade cost"}
                      </div>

                      {atMax ? (
                        <p className="text-sm font-semibold text-emerald-300">
                          Fully upgraded
                        </p>
                      ) : costEntries.length > 0 ? (
                        <div className="space-y-3">
                          {costEntries.map((entry, costIndex) => (
                            <div
                              key={`${entry.name ?? entry.resource}-${costIndex}`}
                              className="flex items-center gap-3"
                            >
                              {entry.resource &&
                              !failedImages[`resource-${entry.resource}`] ? (
                                <img
                                  src={getResourceImage(entry.resource)}
                                  alt={entry.resource}
                                  title={entry.resource}
                                  className="h-7 w-7 shrink-0 object-contain"
                                  onError={() =>
                                    setFailedImages((prev) => ({
                                      ...prev,
                                      [`resource-${entry.resource}`]: true,
                                    }))
                                  }
                                />
                              ) : (
                                <Coins
                                  size={23}
                                  className="shrink-0 text-amber-300"
                                />
                              )}

                              <div className="min-w-0">
                                <p className="break-words text-sm font-bold tabular-nums text-amber-200">
                                  {formatNumber(entry.amount)}
                                </p>
                                <p className="text-xs capitalize text-slate-500">
                                  {entry.resource === "darkElixir"
                                    ? "Dark Elixir"
                                    : entry.resource ?? entry.name}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">
                          Cost unavailable
                        </p>
                      )}

                      {!atMax && (
                        <p className="mt-3 text-xs text-slate-500">
                          Next level: {current + 1}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="px-6 py-16 text-center">
              <Shield
                size={32}
                className="mx-auto mb-4 text-slate-500"
              />
              <h3 className="font-semibold text-slate-200">
                No wall data found
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                No wall records were found in upgradeData.items. Check
                that the incoming data contains wall entries.
              </p>
            </div>
          )}
        </section>

        <p className="mt-5 text-center text-xs text-slate-600">
          Wall levels and upgrade costs are displayed from your existing
          village upgrade data.
        </p>
      </main>
    </div>
  );
}