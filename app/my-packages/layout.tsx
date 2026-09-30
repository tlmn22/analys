import { PlayerShell } from "@/components/player/player-shell";
export const dynamic = "force-dynamic";
export default function MyPackagesLayout({ children }: { children: React.ReactNode }) {
  return <PlayerShell>{children}</PlayerShell>;
}
