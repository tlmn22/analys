"use client";

import { Button } from "@/components/ui/button";
import { Trash2Icon } from "lucide-react";

export function DeleteButton({
  action,
  confirmText,
}: {
  action: (formData: FormData) => void;
  confirmText: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      <Button
        type="submit"
        variant="ghost"
        size="icon-sm"
        className="text-destructive hover:bg-destructive/10"
      >
        <Trash2Icon />
        <span className="sr-only">Устгах</span>
      </Button>
    </form>
  );
}
