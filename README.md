# CCRC Data Comparator

A browser-based tool for checking the accuracy of a CCRC registry export against a cross-check source (such as an aEHR export). Load two Excel workbooks, map the fields between them, and get a per-field accuracy report you can export to Excel.

Everything runs in the browser. Files are parsed locally and are never uploaded to a server.

## Getting started

No build step or install is needed.

1. Open `index.html` in a modern browser (Chrome, Edge, Firefox or Safari).
2. An internet connection is needed on first load for the SheetJS library and Google Fonts, both loaded from CDNs.

## How to use it

1. **Load the files.** Click or drag-and-drop an `.xlsx` / `.xls` file onto each card:
   - **Registry Export (CCRC SQL)**: the registry data to be checked. It can contain several sheets.
   - **Cross-check Source**: the reference data (for example, the aEHR export).
2. **Configure.** Once both files are loaded, the Configuration panel appears:
   - Pick the primary **Registry sheet** and the **Cross-check sheet**.
   - Pick the **ID column** in each file that identifies a patient (for example, a record ID). Rows are matched on this value.
3. **Review the field mapping.** The tool builds a mapping automatically (see [Automatic field mapping](#automatic-field-mapping)). For each row you can:
   - Edit the label shown in the results.
   - Change the registry sheet, registry column or cross-check column.
   - Turn on **Fuzzy** matching, which collapses repeated whitespace before comparing.
   - Remove the row, or add new rows with **+ Add Field**.

   Rows without a cross-check column are skipped during comparison.
4. **Set tolerances (optional).**
   - **Date tolerance (days):** dates within this many days count as a match.
   - **Number tolerance (%):** numbers within this percentage of the cross-check value count as a match.
5. **Run Comparison**, then review the results and use **Export XLSX** to download `CCRC_Comparison_Results.xlsx`.

## Reading the results

The summary at the top shows:

| Metric | Meaning |
| --- | --- |
| Registry Patients | Unique IDs found across all registry sheets |
| Matched to aEHR | Registry IDs that also appear in the cross-check sheet |
| Fields Compared | Number of mapped fields included in the report |
| Avg Registry Accuracy | Mean of the per-field Registry Correct percentages |
| Fields Below 90% | Fields whose Registry Correct percentage is below 90% |

For each field:

- **Count**: patients who have a non-empty registry value for the field *and* appear in the cross-check sheet.
- **Registry Correct (%)**: share of those patients whose registry value matches the cross-check value.
- **aEHR Correct (%)**: share of those patients whose cross-check value is non-empty. This measures how complete the source is, not whether its values are correct.

If a patient has more than one row in a registry sheet, only the first row is used.

## How values are compared

For each field, the cross-check value is decoded and then both values are normalized before comparing:

1. **Decoding.** Coded values in the cross-check file (for example `1` → `yes`) are translated to the text labels used by the registry. The translations live in [js/decoders.js](js/decoders.js) and can be viewed in the app under **Active decode translations**. Columns with no decoder are compared as they are.
2. **Normalization.** Values are trimmed and lowercased, so comparisons ignore case. Dates, whether Excel date cells or strings like `2024-03-01` or `03/01/2024`, are converted to `YYYY-MM-DD`.
3. **Tolerances.** If the values still differ, the date and number tolerances are applied when they are set above 0.

## Automatic field mapping

When both files are loaded, [js/config.js](js/config.js) builds a mapping row for every column in every registry sheet, with these exceptions:

- Columns with no data are skipped.
- Columns that aren't data fields are skipped: MRN, first and last names, `not_in_export` columns, and abstractor-note columns containing `**`.

For each remaining column, it looks for a matching cross-check column in this order:

1. The exact same name
2. The name plus `_1` (palliation fields)
3. The name plus `_2` (repair fields)
4. The name plus `_3` (complete-repair fields)

If none is found, the cross-check column is left blank for you to fill in.

Note that the automatic mapping looks at the **first** sheet in the cross-check workbook.

## Project structure

```
ccrc_comparator/
├── index.html        Page layout; loads the scripts in order
├── styles.css        Styling
└── js/
    ├── config.js     Workbook state and automatic field mapping
    ├── decoders.js   Code-to-label translations for cross-check values
    ├── ui.js         Rendering of selectors, mapping table and results
    ├── compare.js    Comparison logic (no DOM access)
    └── main.js       File loading, app start-up, running and exporting
```

The scripts are plain JavaScript that share global variables, so the order they load in `index.html` matters.

## Updating decoders

The simple code-to-label maps in [js/decoders.js](js/decoders.js) were generated from `CCRC_data_dictionary_202504.xlsx`. To add or change one, edit the `CROSS_DECODE` object:

```js
// Simple lookup: raw value -> label (labels should be lowercase)
"my_field_e": { "0": "no", "1": "yes", "99": "unknown" },

// Custom function for multi-select / bitmask values such as "{1|99}"
"my_multi_e": raw => /* return decoded string */,
```

The key must exactly match the cross-check column name.

## Dependencies

- [SheetJS (xlsx) 0.18.5](https://sheetjs.com/): reads and writes Excel files, loaded from cdnjs
- IBM Plex Sans and IBM Plex Mono from Google Fonts
