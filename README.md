# Aviva Viz 

**Aviva Viz** is a lightweight, zero-dependency, standalone HTML5 dashboard generator for data visualization and analysis. It processes everything client-side, ensuring privacy and speed without the need for a backend server during analysis.

## 🚀 Features

- **Single-File Output**: Generates a self-contained `aviva_dashboard.html` that can be shared and opened in any modern browser.
- **Client-Side Processing**: Load CSV or JSON files via Drag & Drop. Data never leaves your browser.
- **Interactive Visualizations**:
  - **Graphs**: Create Scatter, Bar, and Line charts dynamically.
  - **Data Summary**: Auto-calculated statistics (Mean, Median, Std Dev, etc.).
  - **Data Science Table**: A high-performance, virtualized data grid with multi-column filtering and sorting.
- **State Persistence**: Save your entire dashboard session (loaded data + charts + layout) to a new HTML file to resume work later.
- **Modern UI**: High-contrast "Pitch Day" theme (Yellow `#fed100` / Blue `#00539f`) with specialized neon accents.

## 🛠️ Installation

Aviva Viz is a Python script that bundles the frontend assets. You only need a standard Python installation (3.6+).

```bash
# Clone the repository
git clone https://github.com/DaweiZhuCode/aviva-viz.git

# Navigate to the directory
cd aviva-viz

# No pip install required! (Standard library only)
```

## 🏁 Quick Start

1. **Run the Generator**:
   ```bash
   python aviva_viz.py
   ```
   *This reads the template files and compiles `aviva_dashboard.html`.*

2. **Open the Dashboard**:
   - The script will try to automatically open `aviva_dashboard.html` in your default browser.
   - If not, double-click the file to open it.

3. **Analyze Data**:
   - Drag and drop a `.csv` or `.json` file onto the "Drop Data File" zone.
   - Use the sidebar controls to add charts or view the Data Science Table.

## 📂 Project Structure

```text
aviva_viz/
├── aviva_viz.py          # Main Python generator script
├── aviva_dashboard.html  # Generated output (ignored in git)
├── templates/
│   └── base.html         # Main HTML structure
└── static/
    ├── css/
    │   └── style.css     # Styling (Themes, Layouts, Charts)
    └── js/
        └── app.js        # Core Logic (Data processing, Charting, Virtual Table)
```
