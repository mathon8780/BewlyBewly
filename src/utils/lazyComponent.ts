import type { AsyncComponentLoader } from 'vue'
import { defineAsyncComponent } from 'vue'

import LoadError from '~/components/LoadError.vue'

export function lazyComponent(loader: AsyncComponentLoader) {
  return defineAsyncComponent({ loader, errorComponent: LoadError })
}
