import { useEffect, useState } from "react";

import { useCafeStore } from "../store/cafeStore";
import type { MenuItem } from "../types/menu";
import {
  migrateEmbeddedMenuImage,
  resolveLegacyMenuImageSource,
  resolveMenuImage,
} from "../utils/menuImageStorage";

export function useMenuImageSource(item: MenuItem) {
  const [source, setSource] = useState(() =>
    resolveLegacyMenuImageSource(item.imageDataUrl)
  );

  useEffect(() => {
    let active = true;
    setSource(resolveLegacyMenuImageSource(item.imageDataUrl));

    void resolveMenuImage(item).then((resolvedSource) => {
      if (active) setSource(resolvedSource);
    });

    if (!item.imageKey && item.imageDataUrl) {
      void migrateEmbeddedMenuImage(item)
        .then((imageKey) => {
          if (!imageKey) return;
          useCafeStore.getState().migrateMenuImageReference(item.id, imageKey);
        })
        .catch(() => {
          // Continue rendering the legacy image if migration is unavailable.
        });
    }

    return () => {
      active = false;
    };
  }, [item.id, item.imageDataUrl, item.imageKey, item.updatedAt]);

  return source;
}
