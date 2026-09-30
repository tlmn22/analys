"use server";

import { requireSuperadmin } from "@/lib/club-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function createEmptyEventPackage(name: string, description: string) {
  await requireSuperadmin();
  if (!name.trim() || name.trim().length > 120 || description.length > 2000) return { error: "Нэр 1–120, тайлбар 2000 хүртэл тэмдэгт байна." };
  const { data, error } = await supabaseAdmin().from("event_packages")
    .insert({ name: name.trim(), description: description.trim() }).select("id").single();
  if (error) return { error: error.message };
  return { id: data.id as string };
}
export async function listEventPackages() {
  await requireSuperadmin();
  const { data, error } = await supabaseAdmin().from("event_packages")
    .select("id,name,description").order("created_at", { ascending: false });
  if (error) return { error: error.message, packages: [] };
  return { packages: data as { id: string; name: string; description: string }[] };
}

export async function addEventToPackage(packageId: string, eventId: string) {
  await requireSuperadmin();
  if (!uuid.test(packageId) || !uuid.test(eventId)) return { error: "Багц эсвэл event-ийн ID буруу байна." };
  const { data, error } = await supabaseAdmin().from("event_package_items")
    .upsert({ package_id: packageId, event_id: eventId }, { onConflict: "package_id,event_id", ignoreDuplicates: true })
    .select("id").maybeSingle();
  if (error) return { error: error.message };
  return { success: true, alreadyAdded: !data };
}

export async function createEventPackage(name: string, description: string, eventId: string) {
  await requireSuperadmin();
  if (!name.trim() || name.trim().length > 120) return { error: "Багцын нэр 1–120 тэмдэгт байна." };
  if (description.length > 2000) return { error: "Тайлбар 2000 тэмдэгтээс хэтрэхгүй байна." };
  if (!uuid.test(eventId)) return { error: "Event-ийн ID буруу байна." };
  const { data, error } = await supabaseAdmin().rpc("create_event_package_with_event", {
    package_name: name.trim(), package_description: description.trim(), selected_event_id: eventId,
  });
  if (error) return { error: error.message };
  return { success: true, id: data as string };
}

export async function addEventsToPackage(packageId: string, eventIds: string[]) {
  await requireSuperadmin();
  if (!uuid.test(packageId) || !Array.isArray(eventIds) || !eventIds.length || eventIds.length > 1000 || eventIds.some(id => typeof id !== "string" || !uuid.test(id))) return { error: "1–1000 зөв event сонгоно уу." };
  const ids = [...new Set(eventIds)];
  // One statement: a missing event or package rejects the entire batch.
  const { data, error } = await supabaseAdmin().from("event_package_items")
    .upsert(ids.map(event_id => ({ package_id: packageId, event_id })), { onConflict: "package_id,event_id", ignoreDuplicates: true })
    .select("id");
  if (error) return { error: error.message };
  return { success: true, added: data?.length ?? 0, skipped: ids.length - (data?.length ?? 0) };
}

export async function createEventPackageWithEvents(name: string, description: string, eventIds: string[]) {
  await requireSuperadmin();
  if (!name.trim() || name.trim().length > 120 || description.length > 2000) return { error: "Нэр 1–120, тайлбар 2000 хүртэл тэмдэгт байна." };
  if (!Array.isArray(eventIds) || !eventIds.length || eventIds.length > 1000 || eventIds.some(id => typeof id !== "string" || !uuid.test(id))) return { error: "1–1000 зөв event сонгоно уу." };
  const ids = [...new Set(eventIds)];
  const { data, error } = await supabaseAdmin().rpc("create_event_package_with_events", {
    package_name: name.trim(), package_description: description.trim(), selected_event_ids: ids,
  });
  if (error) return { error: error.message };
  return { success: true, id: data as string, added: ids.length, skipped: 0 };
}
