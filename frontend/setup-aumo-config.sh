#!/bin/bash
set -e

echo "🚀 Setting up central API config..."

# 1. Bikin config central
mkdir -p src/lib
cat > src/lib/config.ts <<'EOF'
export const API_BASE_URL = 
  typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://api.aumo.finance'
    : 'http://localhost:5000';
EOF
echo "✅ src/lib/config.ts created"

# 2. Bikin apiClient yang clean
mkdir -p src/services
cat > src/services/apiClient.ts <<'EOF'
import axios from 'axios';
import { API_BASE_URL } from '@/lib/config';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('userId');
      // window.location.href = '/auth';
    }
    return Promise.reject(err);
  }
);

export default apiClient;
EOF
echo "✅ src/services/apiClient.ts updated"

# 3. Auto-fix semua file yang masih pakai VITE_ / process.env / rawApiUrl / API_BASE_URL hardcode
echo "🔧 Cleaning old API_BASE_URL declarations..."
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  -e '/const API_BASE_URL =/d' \
  -e '/const rawApiUrl =/d' \
  -e '/process\.env\.API_URL/d' \
  -e '/process\.env\.VITE_/d' \
  -e '/import\.meta\.env\.VITE_/d' \
  -e 's/${API_BASE_URL}//g' \
  -e 's|http://localhost:5000||g' \
  {} \;

# 4. Fix double slash yang ke-sisa jadi /api
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|//api|/api|g' {} \;

echo ""
echo "🎉 DONE! Sekarang cek:"
echo "  cat src/lib/config.ts"
echo "  cat src/services/apiClient.ts"
echo ""
echo "Semua page sekarang cukup pakai:"
echo "  apiClient.get('/api/v1/dashboard')"
echo "Ganti URL production cukup edit 1 file: src/lib/config.ts"
