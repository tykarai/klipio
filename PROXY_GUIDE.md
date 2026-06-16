# Proxy Guide for klipio.io

## Your Question: Rotating vs Static Residential?

**Answer: ROTATING RESIDENTIAL is what you need.**

### Why Rotating (Not Static)?

| Type | What It Does | Good For Scraping? |
|------|-------------|-------------------|
| **Rotating** | New IP on every request | ✅ YES — TikTok/Insta can't block you |
| **Static** | Same IP always | ❌ NO — gets blocked in hours |

When yt-dlp extracts from TikTok/Instagram:
- Each video URL request looks like it's from a different user
- Prevents rate limiting and IP bans
- Essential for 100K+ downloads/month

### Webshare Plans Comparison

| Plan | Price | Proxies | Bandwidth | Best For |
|------|-------|---------|-----------|----------|
| **Free** (you have) | $0 | 10 | 1GB/month | Testing only (~1,000 downloads) |
| **Basic Rotating** | $4.49/mo | 250 | 5GB/month | **Launch** (~5,000 downloads) |
| **Standard Rotating** | $9.99/mo | 1,000 | 25GB/month | **Growth** (~25,000 downloads) |
| **Premium Rotating** | $24.99/mo | 5,000 | 100GB/month | **Scale** (~100,000 downloads) |

### Recommendation

**Start with Free ($0) → Upgrade to Basic ($4.49) when you hit 1,000 downloads.**

Webshare rotates automatically on free plan. No configuration needed.

### Proxy URL Format for Webshare

```
http://YOUR_API_KEY@p.webshare.io:80/
```

Example:
```
http://wbn74sbx91sbkok2jka2vep6d02lswl2sc4zis1n@p.webshare.io:80/
```

### How to Verify Your Proxy Works

Run this on your local terminal:
```bash
curl -x "http://wbn74sbx91sbkok2jka2vep6d02lswl2sc4zis1n@p.webshare.io:80/" https://httpbin.org/ip
```

If you see a different IP than your own → ✅ Proxy is working.

### How to Upgrade Webshare Plan

1. Go to https://proxy.webshare.io/account/billing/
2. Click "Upgrade Plan"
3. Select "Rotating Residential" → "Basic" ($4.49/mo)
4. Same API key works — no code changes needed
