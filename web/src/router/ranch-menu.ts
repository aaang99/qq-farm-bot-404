/** Shared ranch navigation contract. Internal tools belong inside their parent page. */
export const ranchMenu = [
  { path: '/ranch', label: '牧场概览', icon: 'i-carbon-chart-pie' },
  { path: '/ranch/personal', label: '我的牧场', icon: 'i-carbon-user' },
  { path: '/ranch/friends', label: '我的好友', icon: 'i-carbon-user-multiple' },
  { path: '/ranch/activity', label: '牧场活动', icon: 'i-carbon-gift' },
  { path: '/ranch/shop', label: '牧场商城', icon: 'i-carbon-shopping-cart' },
  { path: '/ranch/illustrated', label: '牧场图鉴', icon: 'i-carbon-book' },
  { path: '/ranch/analytics', label: '牧场分析', icon: 'i-carbon-analytics' },
  { path: '/ranch/settings', label: '牧场自动化', icon: 'i-carbon-settings' },
]

export function ranchSection(section: string, tab: string): string {
  if (section === 'personal')
    return tab === 'buildings' ? 'buildings' : 'warehouse'
  if (section === 'overview')
    return tab === 'orders' ? 'orders' : 'overview'
  return section
}
