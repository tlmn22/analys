import { PlayerShell } from "@/components/player/player-shell";
export const dynamic = "force-dynamic";
export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return <PlayerShell>{children}</PlayerShell>;
}
