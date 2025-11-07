import { useState } from 'react'

const Settings = () => {
  const [settings, setSettings] = useState({
    companyName: 'Greenstone Talent AI',
    email: 'admin@greenstone.ai',
    timezone: 'UTC-8 (Pacific Time)',
    autoAnalyze: true,
    emailNotifications: false,
    advancedScoring: false,
    linkedinEvaluation: false
  })

  const handleToggle = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="space-y-6">

      {/* General Settings */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold mb-6">General Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Company Name</label>
            <input
              type="text"
              className="glass-input w-full"
              value={settings.companyName}
              onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              className="glass-input w-full"
              value={settings.email}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Timezone</label>
            <input
              type="text"
              className="glass-input w-full"
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* AI Analysis Settings */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold mb-6">AI Analysis Settings</h3>
        <div className="space-y-6">
          <ToggleSetting
            label="Auto-analyze on upload"
            description="Automatically run AI analysis when candidates are uploaded"
            enabled={settings.autoAnalyze}
            onToggle={() => handleToggle('autoAnalyze')}
          />
          <ToggleSetting
            label="Email notifications"
            description="Receive email when analysis completes"
            enabled={settings.emailNotifications}
            onToggle={() => handleToggle('emailNotifications')}
          />
          <ToggleSetting
            label="Advanced scoring"
            description="Include personality and cognitive assessments"
            enabled={settings.advancedScoring}
            onToggle={() => handleToggle('advancedScoring')}
          />
        </div>
      </div>
    </div>
  )
}

const ToggleSetting = ({ label, description, enabled, onToggle }) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <p className="font-medium mb-1">{label}</p>
        <p className="text-sm text-gray-400">{description}</p>
      </div>
      <button
        onClick={onToggle}
        className={`relative w-14 h-8 rounded-full transition-colors ${
          enabled ? 'bg-primary-500' : 'bg-glass-200'
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

export default Settings

