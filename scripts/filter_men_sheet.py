"""Add a "MEN" sheet to TheLeague.xlsx containing only the men's-category
games from the "REGULAR SEASON" sheet. Read-only against the source sheet;
only appends a new sheet to the workbook.

DATES/VENUE are blank on every row but the first of a date/venue group in
the source sheet (merged cells) — forward-filled here so each output row is
self-contained. The LINK column resolves the real hyperlink target when the
cell shows generic display text ("FIBA LiveStats") instead of the URL.
"""

import openpyxl

SRC = "TheLeague.xlsx"

wb = openpyxl.load_workbook(SRC)
ws = wb["REGULAR SEASON"]

date_fmt = ws.cell(row=2, column=2).number_format
time_fmt = ws.cell(row=2, column=3).number_format

cur_date = None
cur_venue = None
men_rows = []
for r in range(2, ws.max_row + 1):
    date_val = ws.cell(row=r, column=2).value
    time_val = ws.cell(row=r, column=3).value
    home = ws.cell(row=r, column=4).value
    away = ws.cell(row=r, column=5).value
    cat = ws.cell(row=r, column=6).value
    venue = ws.cell(row=r, column=7).value
    link_cell = ws.cell(row=r, column=8)

    if date_val is not None:
        cur_date = date_val
    if venue is not None:
        cur_venue = venue
    if not home and not away:
        continue
    if cat and str(cat).strip().lower() == "men":
        link_target = link_cell.hyperlink.target if link_cell.hyperlink else link_cell.value
        men_rows.append((cur_date, time_val, home, away, cat, cur_venue, link_target))

if "MEN" in wb.sheetnames:
    del wb["MEN"]
men_ws = wb.create_sheet("MEN")

headers = ["#", "DATES", "TIME", "Home", "Away", "Category", "VENUE", "LINK"]
men_ws.append(headers)

for i, (date_val, time_val, home, away, cat, venue, link) in enumerate(men_rows, start=1):
    men_ws.append([i, date_val, time_val, home, away, cat, venue, link])
    row_idx = i + 1
    men_ws.cell(row=row_idx, column=2).number_format = date_fmt
    men_ws.cell(row=row_idx, column=3).number_format = time_fmt
    if link:
        men_ws.cell(row=row_idx, column=8).hyperlink = link

men_ws.column_dimensions["A"].width = 5
men_ws.column_dimensions["B"].width = 30
men_ws.column_dimensions["C"].width = 10
men_ws.column_dimensions["D"].width = 22
men_ws.column_dimensions["E"].width = 22
men_ws.column_dimensions["F"].width = 10
men_ws.column_dimensions["G"].width = 16
men_ws.column_dimensions["H"].width = 55

wb.save(SRC)
print(f"MEN sheet created with {len(men_rows)} rows.")
