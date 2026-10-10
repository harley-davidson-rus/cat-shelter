$ErrorActionPreference = 'Stop'
$rules = @(
    @{ Name = 'Cat Shelter HTTP 80'; Port = 80 },
    @{ Name = 'Cat Shelter HTTPS 443'; Port = 443 }
)
foreach ($rule in $rules) {
    if (-not (Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName $rule.Name -Direction Inbound -Action Allow -Protocol TCP -LocalPort $rule.Port | Out-Null
    }
}
