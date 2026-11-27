import React, { useState } from "react";
import {
  Star,
  Users,
  Sparkles,
  ShoppingBag,
  Target,
  Navigation,
  ShieldAlert,
  Coins,
  X,
  MessageSquare,
  Car,
  Crosshair,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface WeaponInfo {
  id: string;
  name: string;
  price: number;
  ammo: number;
  reserve: number;
}

export interface OutfitItem {
  id: string;
  name: string;
  price: number;
  description: string;
  miraColor: string;
  leoColor: string;
}

export interface MissionInfo {
  id: string;
  title: string;
  description: string;
  targetPos: [number, number, number];
  reward: number;
}

export const OUTFIT_CATALOG: OutfitItem[] = [
  {
    id: "sunset",
    name: "Classic Sunset",
    price: 0,
    description: "Sidrah's embroidered maroon gown & Priyanshu's black jacket",
    miraColor: "#991b1b",
    leoColor: "#22272e",
  },
  {
    id: "beach",
    name: "Palm Beach Resort",
    price: 300,
    description: "Coral turquoise sundress & tropical resort shirt",
    miraColor: "#06b6d4",
    leoColor: "#0d9488",
  },
  {
    id: "neon",
    name: "Neon Vice City",
    price: 650,
    description: "Vibrant magenta club cocktail dress & synthwave purple jacket",
    miraColor: "#ec4899",
    leoColor: "#7c3aed",
  },
  {
    id: "glamour",
    name: "Golden Glamour",
    price: 1200,
    description: "Gold sequin evening gown & white luxury tuxedo",
    miraColor: "#eab308",
    leoColor: "#f8fafc",
  },
  {
    id: "midnight",
    name: "Midnight Covert",
    price: 2000,
    description: "Stealth matte black tactical couple attire",
    miraColor: "#18181b",
    leoColor: "#09090b",
  },
];

export const WEAPON_CATALOG: WeaponInfo[] = [
  { id: "fists", name: "Fists", price: 0, ammo: 0, reserve: 0 },
  { id: "pistol", name: "Combat Pistol", price: 250, ammo: 17, reserve: 93 },
  { id: "smg", name: "Micro SMG", price: 650, ammo: 30, reserve: 150 },
  { id: "shotgun", name: "Pump Shotgun", price: 1200, ammo: 8, reserve: 40 },
];

interface GtaHudProps {
  cash: number;
  wantedLevel: number;
  health: number;
  armor: number;
  currentWeapon: WeaponInfo;
  onCycleWeapon: () => void;
  character: "mira" | "leo";
  onSwitchCharacter: () => void;
  activeRoom: string | null;
  onOpenCoop: () => void;
  onOpenMap: () => void;
  onOpenChat: () => void;
  unreadChatCount: number;
  isNearCar: boolean;
  isDrivingCar: boolean;
  onToggleCar: () => void;
  speedKmh: number;
  hotspotNotice: string | null;
  currentMission: MissionInfo;
  missionDistanceMeters: number;
  partnerDistanceMeters: number | null;
  policeDistanceMeters: number;
  bustedBanner: boolean;
  bustedFine: number;
  activeOutfitId: string;
  ownedOutfitIds: string[];
  ownedWeaponIds: string[];
  onBuyOutfit: (outfit: OutfitItem) => void;
  onBuyWeapon: (weapon: WeaponInfo) => void;
}

export function GtaHud({
  cash,
  wantedLevel,
  health,
  armor,
  currentWeapon,
  onCycleWeapon,
  character,
  onSwitchCharacter,
  activeRoom,
  onOpenCoop,
  onOpenMap,
  onOpenChat,
  unreadChatCount,
  isNearCar,
  isDrivingCar,
  onToggleCar,
  speedKmh,
  hotspotNotice,
  currentMission,
  missionDistanceMeters,
  partnerDistanceMeters,
  policeDistanceMeters,
  bustedBanner,
  bustedFine,
  activeOutfitId,
  ownedOutfitIds,
  ownedWeaponIds,
  onBuyOutfit,
  onBuyWeapon,
}: GtaHudProps) {
  const [shopOpen, setShopOpen] = useState(false);
  const [shopTab, setShopTab] = useState<"outfits" | "weapons">("outfits");

  const formattedCash = `$${Math.max(0, Math.floor(cash)).toString().padStart(8, "0")}`;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3 select-none">
      {/* Cinematic BUSTED Overlay */}
      {bustedBanner && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
          <div className="text-red-600 font-black text-6xl sm:text-8xl tracking-widest uppercase drop-shadow-[0_0_25px_rgba(239,68,68,0.9)] animate-pulse">
            BUSTED
          </div>
          <div className="mt-4 text-white text-lg sm:text-xl font-bold tracking-wider">
            You were apprehended by the Vice Patrol
          </div>
          <div className="mt-2 text-red-400 font-mono text-base font-bold">
            Bail paid: -${bustedFine}
          </div>
          <div className="mt-6 text-neutral-400 text-xs uppercase tracking-widest">
            Respawning at Villa Sanctuary...
          </div>
        </div>
      )}

      {/* TOP HEADER ROW */}
      <div className="flex items-start justify-between gap-2">
        {/* Top Left: Game Badge, Co-op Room, Chat & Shop Buttons */}
        <div className="flex flex-col gap-1.5 pointer-events-auto">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-lg">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-black tracking-wider text-white uppercase">OUR CITY</span>
              <span className="text-[10px] text-white/50 tracking-widest hidden sm:inline">WORLD FOR TWO</span>
            </div>

            <Button
              size="sm"
              onClick={onOpenCoop}
              className={`h-8 px-3 rounded-xl text-xs font-bold transition-all shadow-lg ${
                activeRoom
                  ? "bg-emerald-600/90 text-white hover:bg-emerald-500 border border-emerald-400/40"
                  : "bg-black/80 text-white/90 hover:bg-white/10 border border-white/10"
              }`}
            >
              <Users className="w-3.5 h-3.5 mr-1.5" />
              {activeRoom ? `Room: ${activeRoom}` : "2P Co-op"}
            </Button>

            {/* 2P Chat Button */}
            <Button
              size="sm"
              onClick={onOpenChat}
              className={`h-8 px-3 rounded-xl text-xs font-bold transition-all shadow-lg relative ${
                unreadChatCount > 0
                  ? "bg-rose-600 text-white hover:bg-rose-500 animate-pulse border border-rose-400"
                  : "bg-black/80 text-white/90 hover:bg-white/10 border border-white/10"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
              Chat
              {unreadChatCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 bg-white text-rose-600 text-[10px] font-black rounded-full">
                  {unreadChatCount}
                </span>
              )}
            </Button>

            {/* GTA Shop / Wardrobe Button */}
            <Button
              size="sm"
              onClick={() => setShopOpen(true)}
              className="h-8 px-3 rounded-xl text-xs font-bold bg-amber-500/90 hover:bg-amber-400 text-black shadow-lg"
            >
              <ShoppingBag className="w-3.5 h-3.5 mr-1.5" />
              Store
            </Button>
          </div>

          {/* Active Mission Distance Bar */}
          <div className="bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-amber-500/40 shadow-lg flex items-center gap-2 max-w-xs">
            <Target className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            <div className="text-xs text-white overflow-hidden">
              <span className="font-bold text-amber-300">{currentMission.title}</span>
              <span className="text-white/60 ml-2 font-mono font-bold">
                {Math.round(missionDistanceMeters)}m
              </span>
            </div>
          </div>

          {/* Car Driving / Near Car Prompt */}
          {(isNearCar || isDrivingCar) && (
            <div className="bg-black/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-sky-400/50 shadow-lg flex items-center gap-2 text-xs text-sky-200">
              <Car className="w-4 h-4 text-sky-400 animate-bounce" />
              <span>
                {isDrivingCar ? "Driving Convertible • Tap Exit Car to leave" : "Sports Car nearby • Tap Drive"}
              </span>
              <button
                type="button"
                onClick={onToggleCar}
                className="ml-1 px-2.5 py-0.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-black font-extrabold uppercase text-[10px]"
              >
                {isDrivingCar ? "Exit Car" : "Drive"}
              </button>
            </div>
          )}

          {hotspotNotice && (
            <div className="bg-amber-500/90 text-black font-extrabold text-xs px-3 py-1 rounded-lg shadow-md animate-bounce flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{hotspotNotice}</span>
            </div>
          )}
        </div>

        {/* Top Right: Cash, Wanted Stars, Weapon & Health */}
        <div className="flex flex-col items-end gap-1.5 pointer-events-auto">
          {/* Green Cash Counter */}
          <div className="bg-black/90 backdrop-blur-md px-3.5 py-1 rounded-xl border border-emerald-500/30 shadow-xl flex items-center gap-1">
            <span className="text-emerald-400 font-mono text-xl sm:text-2xl font-black tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              {formattedCash}
            </span>
          </div>

          {/* Wanted Level Stars (5 Stars) */}
          <div className="bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10 flex items-center gap-1 shadow-lg">
            {[1, 2, 3, 4, 5].map((starNum) => {
              const active = starNum <= wantedLevel;
              return (
                <Star
                  key={starNum}
                  className={`w-4 h-4 transition-all duration-300 ${
                    active
                      ? "text-red-500 fill-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] scale-110"
                      : "text-white/20"
                  }`}
                />
              );
            })}
          </div>

          {/* Weapon Slot & Ammo Counter */}
          <div
            onClick={onCycleWeapon}
            className="cursor-pointer bg-black/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/15 hover:border-amber-400/50 shadow-xl flex items-center gap-2.5 active:scale-95 transition"
          >
            <div className="flex flex-col items-end">
              <span className="text-[11px] font-black uppercase text-amber-400 tracking-wider">
                {currentWeapon.name}
              </span>
              {currentWeapon.ammo > 0 && (
                <span className="font-mono text-xs font-bold text-white tracking-widest">
                  {currentWeapon.ammo} / {currentWeapon.reserve}
                </span>
              )}
            </div>
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center text-white/80">
              <Crosshair className="w-4 h-4 text-amber-400" />
            </div>
          </div>

          {/* Health & Armor Bars */}
          <div className="flex flex-col gap-1 w-28 bg-black/80 backdrop-blur-md p-1.5 rounded-lg border border-white/10">
            <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-300 shadow-[0_0_6px_rgba(16,185,129,0.8)]"
                style={{ width: `${health}%` }}
              />
            </div>
            <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-sky-500 h-full rounded-full transition-all duration-300 shadow-[0_0_6px_rgba(14,165,233,0.8)]"
                style={{ width: `${armor}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM CENTER: Speedometer & Radar Distances */}
      <div className="self-center flex flex-col items-center gap-1">
        {speedKmh > 0.5 && (
          <div className="bg-black/75 backdrop-blur-md px-3.5 py-1 rounded-full border border-white/15 text-xs font-mono font-bold text-white/90 shadow-md">
            {isDrivingCar ? `🚗 ${speedKmh} KM/H` : `${speedKmh} KM/H`}
          </div>
        )}

        {/* Live Radar Distance Indicators */}
        <div className="flex items-center gap-2 bg-black/75 backdrop-blur-md px-3 py-1 rounded-full border border-white/15 text-[11px] font-bold text-white">
          {partnerDistanceMeters !== null && (
            <span className="flex items-center gap-1 text-pink-400">
              <span>💖 Partner:</span>
              <span className="font-mono">{Math.round(partnerDistanceMeters)}m</span>
            </span>
          )}
          {wantedLevel > 0 && (
            <span className="flex items-center gap-1 text-red-400 animate-pulse ml-1">
              <span>🚨 Police:</span>
              <span className="font-mono">{Math.round(policeDistanceMeters)}m</span>
            </span>
          )}
        </div>
      </div>

      {/* GTA Store & Wardrobe Modal */}
      {shopOpen && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-zinc-900 border border-white/15 rounded-2xl w-full max-w-lg p-5 shadow-2xl flex flex-col gap-4 text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-black tracking-wide">VICE CITY OUTFITS & ARMORY</h2>
              </div>
              <button
                type="button"
                onClick={() => setShopOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5 text-white/70" />
              </button>
            </div>

            <div className="bg-black/60 px-4 py-2 rounded-xl border border-emerald-500/30 flex items-center justify-between">
              <span className="text-xs text-white/60 font-bold uppercase tracking-wider">Your Funds:</span>
              <span className="font-mono text-emerald-400 font-black text-xl">{formattedCash}</span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShopTab("outfits")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                  shopTab === "outfits" ? "bg-amber-500 text-black" : "bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                Wardrobe Outfits
              </button>
              <button
                type="button"
                onClick={() => setShopTab("weapons")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                  shopTab === "weapons" ? "bg-amber-500 text-black" : "bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                Weapons & Gear
              </button>
            </div>

            {/* Outfits List */}
            {shopTab === "outfits" && (
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                {OUTFIT_CATALOG.map((outfit) => {
                  const owned = ownedOutfitIds.includes(outfit.id);
                  const isEquipped = activeOutfitId === outfit.id;
                  const canAfford = cash >= outfit.price;

                  return (
                    <div
                      key={outfit.id}
                      className="bg-black/40 border border-white/10 p-3 rounded-xl flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-bold text-sm text-white flex items-center gap-2">
                          <span>{outfit.name}</span>
                          {isEquipped && (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 px-1.5 py-0.5 rounded-md font-extrabold">
                              EQUIPPED
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-white/50">{outfit.description}</div>
                      </div>
                      <Button
                        size="sm"
                        disabled={isEquipped || (!owned && !canAfford)}
                        onClick={() => onBuyOutfit(outfit)}
                        className={`shrink-0 text-xs font-bold h-8 px-3 rounded-lg ${
                          isEquipped
                            ? "bg-white/10 text-white/40 cursor-default"
                            : owned
                            ? "bg-sky-600 hover:bg-sky-500 text-white"
                            : canAfford
                            ? "bg-amber-500 hover:bg-amber-400 text-black font-extrabold"
                            : "bg-white/5 text-white/30"
                        }`}
                      >
                        {isEquipped ? "Wearing" : owned ? "Equip" : `$${outfit.price}`}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Weapons List */}
            {shopTab === "weapons" && (
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                {WEAPON_CATALOG.map((weapon) => {
                  const owned = ownedWeaponIds.includes(weapon.id);
                  const isCurrent = currentWeapon.id === weapon.id;
                  const canAfford = cash >= weapon.price;

                  return (
                    <div
                      key={weapon.id}
                      className="bg-black/40 border border-white/10 p-3 rounded-xl flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-bold text-sm text-white flex items-center gap-2">
                          <span>{weapon.name}</span>
                          {isCurrent && (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 px-1.5 py-0.5 rounded-md font-extrabold">
                              IN HAND
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-white/50">
                          {weapon.ammo > 0 ? `${weapon.ammo} rounds ready / ${weapon.reserve} reserve` : "Hand-to-hand combat"}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={isCurrent || (!owned && !canAfford)}
                        onClick={() => onBuyWeapon(weapon)}
                        className={`shrink-0 text-xs font-bold h-8 px-3 rounded-lg ${
                          isCurrent
                            ? "bg-white/10 text-white/40 cursor-default"
                            : owned
                            ? "bg-sky-600 hover:bg-sky-500 text-white"
                            : canAfford
                            ? "bg-amber-500 hover:bg-amber-400 text-black font-extrabold"
                            : "bg-white/5 text-white/30"
                        }`}
                      >
                        {isCurrent ? "Equipped" : owned ? "Equip" : `$${weapon.price}`}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
