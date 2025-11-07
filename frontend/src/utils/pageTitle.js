// Helper to get page title from pathname
export const getPageTitle = (pathname) => {
  if (pathname === '/') return { title: 'Dashboard', subtitle: 'Overview of your talent pipeline' }
  if (pathname === '/jobs') return { title: 'Job Posts', subtitle: 'Manage your open positions and track candidates' }
  if (pathname.startsWith('/jobs/')) return { title: 'Job Detail', subtitle: 'Manage candidates for this position' }
  if (pathname === '/reports') return { title: 'Reports & Analytics', subtitle: 'Global insights across all positions' }
  if (pathname === '/settings') return { title: 'Settings', subtitle: 'Manage your preferences and configurations' }
  if (pathname.startsWith('/candidates/')) return { title: 'Candidate Profile', subtitle: 'Detailed candidate evaluation' }
  return { title: 'Greenstone Talent AI', subtitle: '' }
}

