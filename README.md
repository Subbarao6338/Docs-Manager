# Sark Docs Manager

**Sark Docs Manager** is the ultimate all-in-one document solution for viewing, creating, editing, and managing documents privately, instantly, and completely offline.

Bringing together the power of Adobe Acrobat, Nitro PDF, Foxit PDF, PDFgear, WPS Office, and Microsoft Office (Word, Excel, PowerPoint) into a feather-light, lightning-fast application.

## Key Features

### 1. Document Creation & Authoring
- **New PDF**: Create blank or structured PDF documents from scratch.
- **New Word Document (.docx)**: Author rich text documents directly.
- **New Spreadsheet (.xlsx)**: Build worksheets, tables, and financial sheets.
- **New Presentation (.pptx)**: Create slide decks and presentations.

### 2. Comprehensive PDF Editing & Tools
- **Rich Text Editing**: Insert and edit text with customized font sizes, weights (bold), italics, color palettes, and alignments (left, center, right).
- **In-Place Image Editing**: Insert pictures directly onto PDF pages, reposition, resize, control opacity, and export.
- **Fill & Sign**: Complete PDF forms, draw or import digital signatures, add date stamps and checkmarks.
- **Markup & Annotations**: Freehand drawing, highlighters, underlines, strikethroughs, sticky notes, and plan measurement tools.
- **Document Management**: Merge PDFs, split pages, extract sheets, organize and re-order pages, add watermarks, and encrypt/decrypt passwords.
- **OCR Text Extraction**: Read and extract text from scans and pictures on-device without network access.

### 3. Ultimate Office & Document Viewer
- High-fidelity viewer for PDF, Word (`.docx`, `.doc`), Excel (`.xlsx`, `.xls`, `.csv`), PowerPoint (`.pptx`, `.ppt`), OpenDocument (`.odt`, `.ods`, `.odp`), RTF, Markdown, EPUB, and images.
- Smart inspection of misnamed or extensionless files.
- Complete privacy: zero tracking, no accounts, no ads, 100% offline.

---

## Downloads & Platform Variants

Releases are published automatically via GitHub Releases with dynamic build versioning and release notes:

| Platform | Variant & Package | Notes |
|---|---|---|
| **Windows 10 / 11** | `windows/Sark-Docs-Manager_<version>_x64-setup.exe` & `.msi` | Native installer |
| **Linux** | `linux/` (Flatpak, AppImage, `.deb`, `.rpm`) | Universal Flatpak bundle + distribution packages |
| **Android (ARM64)** | `android/SarkDocsManager-v<version>-arm64.apk` | High-performance 64-bit APK |

Release artifacts are organized in dedicated folders (`windows/`, `linux/`, `android/`) with persistent release signing keys to eliminate reinstall and signature conflict issues.

---

## Development & Build

Requires Node 20+ and Rust stable:

```bash
# Install dependencies
npm install

# Start development preview
npm run dev

# Run unit tests
npm test

# Build production bundle
npm run build
```

---

## License

MIT License.
