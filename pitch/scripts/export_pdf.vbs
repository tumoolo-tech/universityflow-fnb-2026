' Exports a .pptx to PDF with PowerPoint, for print, so pictures keep their full resolution
' (SaveAs PDF uses the screen intent, which downsamples). Called by export_pdf.ps1:
'   cscript //nologo export_pdf.vbs <deck.pptx> <out.pdf>
' Late-bound callers must pass a real PrintRange, or PowerPoint answers "Type mismatch".
Dim app, pres, rng
Set app = CreateObject("PowerPoint.Application")
Set pres = app.Presentations.Open(WScript.Arguments(0), True, False, False)
pres.PrintOptions.Ranges.ClearAll
Set rng = pres.PrintOptions.Ranges.Add(1, pres.Slides.Count)
' PDF (2), print intent (2), no frame (0), handout order (1), slides (1), no hidden slides (0),
' this range, a slide range (4)
pres.ExportAsFixedFormat WScript.Arguments(1), 2, 2, 0, 1, 1, 0, rng, 4
pres.Close
app.Quit
