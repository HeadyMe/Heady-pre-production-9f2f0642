#!/bin/bash
# HeadySystems Infrastructure Security Audit
# Runs CIS benchmarks and generates hardening report

set -euo pipefail

echo "🔒 HeadySystems Infrastructure Audit"
echo "===================================="
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root"
   exit 1
fi

AUDIT_DIR="/var/log/heady-audit"
mkdir -p "$AUDIT_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT="$AUDIT_DIR/audit_${TIMESTAMP}.txt"

echo "📊 Generating report: $REPORT"
echo ""

# Function to check and report
check_item() {
    local description="$1"
    local command="$2"
    local expected="$3"

    echo -n "Checking: $description... "
    result=$(eval "$command" 2>/dev/null || echo "FAILED")

    if [[ "$result" == "$expected" ]]; then
        echo "✅ PASS" | tee -a "$REPORT"
    else
        echo "❌ FAIL (got: $result, expected: $expected)" | tee -a "$REPORT"
    fi
}

echo "=== OS Hardening ===" | tee -a "$REPORT"
check_item "SSH root login disabled" "grep '^PermitRootLogin' /etc/ssh/sshd_config | awk '{print \$2}'" "no"
check_item "Firewall enabled" "systemctl is-active ufw" "active"
check_item "Automatic updates enabled" "systemctl is-active unattended-upgrades" "active"

echo "" | tee -a "$REPORT"
echo "=== Network Security ===" | tee -a "$REPORT"
check_item "IP forwarding disabled" "sysctl net.ipv4.ip_forward | awk '{print \$3}'" "0"
check_item "SYN cookies enabled" "sysctl net.ipv4.tcp_syncookies | awk '{print \$3}'" "1"
check_item "ICMP redirects disabled" "sysctl net.ipv4.conf.all.accept_redirects | awk '{print \$3}'" "0"

echo "" | tee -a "$REPORT"
echo "=== File System Security ===" | tee -a "$REPORT"
check_item "/tmp mounted with noexec" "mount | grep '/tmp' | grep -q noexec && echo 'yes' || echo 'no'" "yes"
check_item "/home mounted with nodev" "mount | grep '/home' | grep -q nodev && echo 'yes' || echo 'no'" "yes"

echo "" | tee -a "$REPORT"
echo "=== Service Hardening ===" | tee -a "$REPORT"
check_item "Redis authentication enabled" "grep '^requirepass' /etc/redis/redis.conf | wc -l" "1"
check_item "Docker daemon socket permissions" "stat -c '%a' /var/run/docker.sock" "660"

echo "" | tee -a "$REPORT"
echo "=== Monitoring ===" | tee -a "$REPORT"
check_item "Audit logging active" "systemctl is-active auditd" "active"
check_item "Log rotation configured" "test -f /etc/logrotate.d/heady && echo 'yes' || echo 'no'" "yes"

echo ""
echo "✅ Audit complete! Report saved to: $REPORT"
echo ""
echo "📈 Summary:"
grep -c "✅ PASS" "$REPORT" || echo "0"
echo " checks passed"
grep -c "❌ FAIL" "$REPORT" || echo "0"
echo " checks failed"
