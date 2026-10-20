import type { App, Component, Plugin } from 'vue'
import { defineAsyncComponent } from 'vue'

const paths = import.meta.glob<{ default: Component }>(['./*/*.vue', './*.vue', './OverlayScrollbarsComponent.ts'])

export default {
  install: (app: App) => {
    for (const path in paths) {
      const splitPath = path.split('/')
      const name = splitPath[splitPath.length - 1].replace('.vue', '').replace('.ts', '')
      app.component(name, defineAsyncComponent(paths[path]))
    }
  },
} as Plugin
