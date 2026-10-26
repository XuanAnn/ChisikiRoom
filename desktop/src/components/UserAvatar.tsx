import { useEffect, useState } from 'react';
const cache = new Map<string, Promise<string | null>>();
window.chisiki?.onEvent((e) => {
  if (e.type === 'PROFILE_CHANGED') {
    cache.delete(e.data.userId);
  }
  if (e.type === 'SIGNED_OUT') {
    cache.clear();
  }
});
function load(id: string) {
  if (!cache.has(id)) {
    cache.set(id, window.chisiki?.avatar(id) || Promise.resolve(null));
  }
  return cache.get(id)!;
}
export function UserAvatar({ id, name }: { id: string; name: string }) {
  const [image, setImage] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      load(id).then((value) => {
        if (active) {
          setImage(value);
        }
      });
    void refresh();
    const unsub = window.chisiki?.onEvent((e) => {
      if (e.type === 'PROFILE_CHANGED' && e.data.userId === id) {
        void refresh();
      }
    });
    return () => {
      active = false;
      unsub?.();
    };
  }, [id]);
  return (
    <div className="avatar">{image ? <img src={image} alt={name} /> : name[0]?.toUpperCase()}</div>
  );
}
