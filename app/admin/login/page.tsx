"use client";

import Image from "next/image";
import { useActionState } from "react";
import { login, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center gap-6 bg-muted/30 p-4">
      <Image src="/logo.png" alt="HoopsLab" width={160} height={160} priority />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Нэвтрэх</CardTitle>
          <CardDescription>Клубын ажилтан email, нууц үгээрээ нэвтэрнэ. Superadmin email-ийг хоосон орхино.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="username" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Нууц үг</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                autoFocus
                required
              />
            </div>
            {state?.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Нэвтэрч байна..." : "Нэвтрэх"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
