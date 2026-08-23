import { logout } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { LogOutIcon } from "lucide-react";

export function LogoutButton() {
  return (
    <form action={logout}>
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="w-full justify-start"
      >
        <LogOutIcon />
        Гарах
      </Button>
    </form>
  );
}
