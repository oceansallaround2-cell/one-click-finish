import React from "react";
import { Star, Users, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface WeaponInfo {
  id: string;
  name: string;
  ammo: number;
  reserve: number;
}

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
  speedKmh: number;
  hotspotNotice: string | null;
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
  speedKmh,
  hotspotNotice,
}: GtaHudProps) {
  // Format cash as $00024873 matching your GTA screenshot
  const formattedCash = `$${Math.max(0, Math.floor(cash)).toString().padStart(8, "0")}`;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3 select-none">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-2">
        {/* Top Left: Logo & 2-Player Co-op */}
        <div className="flex flex-col gap-1.5 pointer-events-auto">
          <div className="flex items-center gap-2">
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
          </div>

          {hotspotNotice && (
            <div className="bg-amber-500/90 text-black font-extrabold text-xs px-3 py-1 rounded-lg shadow-md animate-bounce flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{hotspotNotice}</span>
            </div>
          )}
        </div>

        {/* Top Right: GTA Cash, Wanted Stars, Weapon & Health */}
        <div className="flex flex-col items-end gap-1.5 pointer-events-auto">
          {/* Green Cash Counter */}
          <div className="bg-black/90 backdrop-blur-md px-3.5 py-1 rounded-xl border border-emerald-500/30 shadow-xl flex items-center gap-1">
            <span className="text-emerald-400 font-mono text-xl sm:text-2xl font-black tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              {formattedCash}
            </span>
          </div>

          {/* 5-Star Wanted Level Bar */}
          <div className="flex items-center gap-0.5 bg-black/75 px-2.5 py-1 rounded-lg border border-white/10 shadow-md">
            {[1, 2, 3, 4, 5].map((starIndex) => {
              const isFilled = starIndex <= wantedLevel;
              return (
                <Star
                  key={starIndex}
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                    isFilled
                      ? "text-amber-400 fill-amber-400 animate-pulse filter drop-shadow-[0_0_4px_rgba(251,191,36,0.8)]"
                      : "text-white/20"
                  }`}
                />
              );
            })}
          </div>

          {/* Weapon Box with Ammo (Pistol 17 / 93) */}
          <button
            type="button"
            onClick={onCycleWeapon}
            className="bg-black/85 hover:bg-black/95 transition px-3 py-1.5 rounded-xl border border-white/15 shadow-lg flex items-center gap-2.5 cursor-pointer"
          >
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold tracking-wider text-white/60">
                {currentWeapon.name}
              </div>
              <div className="text-xs font-mono font-bold text-amber-300">
                {currentWeapon.ammo} / {currentWeapon.reserve}
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/90 text-sm font-bold border border-white/10">
              {currentWeapon.id === "pistol" ? "🔫" : currentWeapon.id === "smg" ? "⚡" : "👊"}
            </div>
          </button>

          {/* Health & Armor Bars */}
          <div className="w-28 sm:w-32 flex flex-col gap-1 bg-black/70 p-1.5 rounded-lg border border-white/10">
            <div className="w-full bg-white/15 h-2 rounded-full overflow-hidden flex">
              <div
                className="bg-sky-400 h-full transition-all duration-300 rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, armor))}%` }}
              />
            </div>
            <div className="w-full bg-white/15 h-2 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, health))}%` }}
              />
            </div>
          </div>

          {/* Character Quick Switcher */}
          <button
            type="button"
            onClick={onSwitchCharacter}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition shadow-md border ${
              character === "mira"
                ? "bg-rose-600/90 hover:bg-rose-500 text-white border-rose-400/40"
                : "bg-sky-600/90 hover:bg-sky-500 text-white border-sky-400/40"
            }`}
          >
            {character === "mira" ? "👗 Mira (Tap to Leo)" : "🧥 Leo (Tap to Mira)"}
          </button>
        </div>
      </div>

      {/* Speedometer overlay when moving */}
      {speedKmh > 0.5 && (
        <div className="self-center bg-black/75 backdrop-blur-md px-3 py-1 rounded-full border border-white/15 text-xs font-mono font-bold text-white/90">
          {speedKmh.toFixed(0)} KM/H
        </div>
      )}
    </div>
  );
                                 }

