# Deployment Notes

## Known Warnings (Non-Critical)

### Browser Console Warnings

#### 1. Tailwind CDN Warning ⚠️ (Expected)
```
cdn.tailwindcss.com should not be used in production
```
**Status:** Known limitation
**Impact:** None in development
**Fix for production:** Install Tailwind CSS as a PostCSS plugin
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init
```

#### 2. CSS Compatibility Warning ⚠️ (Informational)
```
'-webkit-text-size-adjust' is not supported by Chrome, Edge 79+, Firefox, Safari
```
**Status:** Browser developer tools compatibility notice
**Impact:** None - this is from Tailwind CSS CDN's internal styles
**Action required:** None - this doesn't affect functionality

### Fixed Issues ✅

#### 1. Trust Proxy Configuration (FIXED)
**Previous Error:**
```
ERR_ERL_PERMISSIVE_TRUST_PROXY: trust proxy setting is true
```
**Solution:** Changed from `app.set('trust proxy', true)` to `app.set('trust proxy', 1)`
- Railway uses a single proxy layer, so we trust only 1 hop
- Prevents IP spoofing while allowing proper client IP detection

#### 2. Security Headers (FIXED)
Added helmet.js middleware for:
- ✅ `x-content-type-options: nosniff`
- ✅ Removed `x-powered-by` header
- ✅ Added `cache-control` headers for static assets
- ✅ Multiple other security headers via helmet

#### 3. File Upload MIME Type (FIXED)
**Previous Error:**
```
Invalid file type: application/octet-stream
```
**Solution:** Added extension-based validation for .md files sent with `application/octet-stream` MIME type

## Production Checklist

Before deploying to production, consider:

- [ ] Replace Tailwind CDN with installed Tailwind CSS
- [ ] Configure CSP (Content Security Policy) headers
- [ ] Set up proper logging/monitoring
- [ ] Configure database (if needed) instead of in-memory session storage
- [ ] Set up proper backup/restore procedures
- [ ] Configure rate limiting per your actual traffic patterns

## Environment Variables

Required:
- `API_KEY` - Your Gemini API key

Optional:
- `PORT` - Server port (default: 3000, Railway sets this automatically)
- `NODE_ENV` - Set to 'production' for production deployments
