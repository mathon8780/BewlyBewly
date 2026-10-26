import { useFocusTrap } from '@vueuse/integrations/useFocusTrap'
import type { Ref } from 'vue'

import { findLeafActiveElement } from '~/utils/element'

export function useModalFocus(element: Ref<HTMLElement | undefined>) {
  const previous = findLeafActiveElement(document)
  useFocusTrap(element, {
    immediate: true,
    allowOutsideClick: true,
    fallbackFocus: () => element.value!,
    setReturnFocus: () => previous as HTMLElement,
    tabbableOptions: { getShadowRoot: true },
  })
}
