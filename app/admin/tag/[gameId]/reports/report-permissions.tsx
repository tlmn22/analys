"use client";

import { createContext, useContext, type ReactNode } from "react";

const ReportReadOnly = createContext(true);
export const useReportReadOnly = () => useContext(ReportReadOnly);

export function ReportPermissions({ readOnly, children }: { readOnly: boolean; children: ReactNode }) {
  return <ReportReadOnly.Provider value={readOnly}>{children}</ReportReadOnly.Provider>;
}
