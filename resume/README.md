# Resume source

`resume.html` is the source of truth for `public/resume.pdf`. Edit the HTML
(content should track `Adam_Dustin_Career_Knowledge_Base.md` — general-purpose
positioning, not tailored to one job posting) then regenerate the PDF:

```bash
# Windows, from the repo root - requires Edge (ships with Windows):
"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="$(pwd)/public/resume.pdf" "file:///$(pwd | sed 's#^/c#C:#')/resume/resume.html"
```

(Any headless Chromium-based browser's `--print-to-pdf` works the same way if
Edge isn't available - Chrome's flag and syntax are identical.)

After regenerating, open `public/resume.pdf` and check it's still one page -
the `@page` margins and font sizes in `resume.html` are already tuned tight
for that; adding more than a line or two of content will push it to a second
page and need the margins/font-size tightened further to compensate.
