import { useEffect, useRef, useState } from 'react';

export function usePagedList(api, endpoint) {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [offset, setOffset] = useState(0);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const previous = useRef(endpoint);
  useEffect(() => {
    setLoading(true);
    if (previous.current !== endpoint) {
      previous.current = endpoint;
      if (offset) { setOffset(0); return; }
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setError('');
      try {
        const url = new URL(endpoint, window.location.origin);
        url.searchParams.set('limit', '50');
        url.searchParams.set('offset', String(offset));
        const payload = await api(`${url.pathname}${url.search}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        const last = Math.max(0, Math.floor((payload.meta.total - 1) / 50) * 50);
        if (offset > last) { setOffset(last); return; }
        setItems(payload.data); setMeta(payload.meta);
      } catch (error) {
        if (!controller.signal.aborted) { setItems([]); setMeta({ total: 0 }); setError(error.message); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [api, endpoint, offset, version]);
  return { items, meta, offset, setOffset, loading, error, load: () => setVersion((value) => value + 1) };
}
