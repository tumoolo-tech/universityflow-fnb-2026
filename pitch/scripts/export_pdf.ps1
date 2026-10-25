# Exports ../UniversityFlow_FNB_Hackathon_2026.pptx to PDF (and optional PNG previews) with PowerPoint.
# Needs Microsoft PowerPoint and the Outfit fonts in ../fonts installed for the PDF to embed them.
# 1. export_pdf.vbs exports for print (PowerShell can't pass that method's COM arguments).
# 2. sharpen_pdf.py puts the full-resolution screenshots back: PowerPoint downsamples every
#    picture to about 200 ppi in a PDF, even for print.
param([string]$PngDir = "")
$deck = (Resolve-Path "$PSScriptRoot\..\UniversityFlow_FNB_Hackathon_2026.pptx").Path
$pdf  = [IO.Path]::ChangeExtension($deck, ".pdf")
cscript //nologo "$PSScriptRoot\export_pdf.vbs" $deck $pdf
if ($LASTEXITCODE -ne 0) { throw "PDF export failed" }
python "$PSScriptRoot\sharpen_pdf.py"
if ($LASTEXITCODE -ne 0) { throw "sharpen_pdf.py failed" }
if ($PngDir) {
  $app = New-Object -ComObject PowerPoint.Application
  try {
    $p = $app.Presentations.Open($deck, $true, $false, $false)
    New-Item -ItemType Directory -Force $PngDir | Out-Null
    Get-ChildItem $PngDir -Filter *.png | Remove-Item
    $i = 0
    foreach ($s in $p.Slides) { $i++; $s.Export((Join-Path $PngDir ("slide-{0:D2}.png" -f $i)), "PNG", 3840, 2160) }
    $p.Close()
  } finally { $app.Quit() }
}
"pdf: $pdf"
