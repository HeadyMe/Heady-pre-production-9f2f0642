const fetch = require('node-fetch');
const token = "VGNo4jwin3V6eFO0HpGGYUyn2iWFM6JpkPfdIqUa";
const zoneId = "d71262d0faa509f890fd5fea413c39bc";
const target = "heady-manager-609590223909.us-central1.run.app";

async function updateDNS(id, name) {
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${id}`;
    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            type: 'CNAME',
            name: name,
            content: target,
            proxied: true,
            ttl: 1
        })
    });
    const data = await res.json();
    console.log(`Updated ${name}:`, data.success ? 'SUCCESS' : 'FAILED', JSON.stringify(data.errors));
}

async function run() {
    await updateDNS("e7dd1223ad17290d8848a4d9a13af3f1", "headysystems.com");
    await updateDNS("2febb63db75ee466361fd46ab1bb0c1e", "www.headysystems.com");
}

run();
