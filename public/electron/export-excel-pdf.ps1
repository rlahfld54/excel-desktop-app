param(
  [Parameter(Mandatory = $true)][string]$FolderPath,
  [Parameter(Mandatory = $true)][int]$FileCount
)

$ErrorActionPreference = 'Stop'
$excel = $null
$workbook = $null

try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $excel.AutomationSecurity = 3
  for ($index = 0; $index -lt $FileCount; $index++) {
    $inputPath = Join-Path $FolderPath "$index.xlsx"
    $outputPath = Join-Path $FolderPath "$index.pdf"
    try {
      $workbook = $excel.Workbooks.Open($inputPath, 0, $true)
      # xlTypePDF=0, xlQualityStandard=0, IgnorePrintAreas=false
      $workbook.ExportAsFixedFormat(0, $outputPath, 0, $true, $false)
    } catch {
      throw "Excel 파일 $($index + 1)/$FileCount PDF 변환 실패: $($_.Exception.Message)"
    } finally {
      if ($workbook -ne $null) {
        $workbook.Close($false)
        [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($workbook)
        $workbook = $null
      }
    }
  }
} finally {
  if ($workbook -ne $null) {
    $workbook.Close($false)
    [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($workbook)
  }
  if ($excel -ne $null) {
    $excel.Quit()
    [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($excel)
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
