function Parse-Yaml {
    param([string]$yamlContent)
    $result = [ordered]@{}
    $lines = $yamlContent -split "`r?`n"
    $currentSection = $null
    
    foreach ($line in $lines) {
        if ($line -match '^\s*([^:]+):\s*$') {
            # Section header
            $currentSection = $matches[1].Trim()
            $result[$currentSection] = @{}
        } elseif ($line -match '^\s*([^:]+):\s*(.*)') {
            # Key-value pair
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            
            if ($currentSection) {
                $result[$currentSection][$key] = $value
            } else {
                $result[$key] = $value
            }
        }
    }
    return $result
}
