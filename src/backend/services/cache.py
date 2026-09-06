import time
import json
import logging
from typing import Optional, Any

logger = logging.getLogger("CacheService")

class MemoryCache:
    """
    High-performance in-memory cache with TTL support and optional Redis fallback.
    """
    def __init__(self):
        self._store = {}
        self._redis_client = None
        self._init_redis()

    def _init_redis(self):
        try:
            import redis
            # Quick check if Redis is running locally
            r = redis.Redis(host='localhost', port=6379, db=0, socket_connect_timeout=0.2)
            r.ping()
            self._redis_client = r
            logger.info("Connected to Redis cache backend.")
        except Exception:
            self._redis_client = None
            logger.info("Using internal In-Memory TTL Cache.")

    def get_cached_result(self, key: str) -> Optional[Any]:
        if self._redis_client:
            try:
                val = self._redis_client.get(key)
                if val:
                    return json.loads(val.decode('utf-8'))
            except Exception:
                pass
                
        entry = self._store.get(key)
        if not entry:
            return None
            
        value, expiry = entry
        if expiry and time.time() > expiry:
            del self._store[key]
            return None
            
        return value

    def set_cache(self, key: str, value: Any, ttl: int = 86400) -> None:
        if self._redis_client:
            try:
                self._redis_client.setex(key, ttl, json.dumps(value))
                return
            except Exception:
                pass
                
        expiry = time.time() + ttl if ttl > 0 else None
        self._store[key] = (value, expiry)

    def invalidate_cache(self, key: str) -> None:
        if self._redis_client:
            try:
                self._redis_client.delete(key)
            except Exception:
                pass
        self._store.pop(key, None)

    def clear_all_cache(self) -> None:
        if self._redis_client:
            try:
                self._redis_client.flushdb()
            except Exception:
                pass
        self._store.clear()

# Global cache instance
cache_service = MemoryCache()
