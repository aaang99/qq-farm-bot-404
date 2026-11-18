import { menuRoutes } from './menu'
import { ranchMenu } from './ranch-menu'

export type SceneKey = 'farm' | 'ranch'

export interface SceneMenuItem {
  path: string
  label: string
  icon: string
}

/** 牧场子页面前缀，用于判定当前是否处于牧场场景 */
const RANCH_PREFIX = '/ranch'

export const ranchSceneItems: SceneMenuItem[] = ranchMenu.map(item => ({
  path: item.path,
  label: item.label,
  icon: item.icon,
}))

/** 农场场景：沿用主菜单（牧场已标记 showInNav: false，由场景切换按钮进入） */
export const farmSceneItems: SceneMenuItem[] = menuRoutes
  .filter(item => item.showInNav !== false)
  .map(item => ({
    path: item.path ? `/${item.path}` : '/',
    label: item.label,
    icon: item.icon,
  }))

export function resolveScene(path: string): SceneKey {
  return path === RANCH_PREFIX || path.startsWith(`${RANCH_PREFIX}/`) ? 'ranch' : 'farm'
}

export function sceneHome(scene: SceneKey): string {
  return scene === 'ranch' ? RANCH_PREFIX : '/'
}
