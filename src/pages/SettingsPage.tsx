import { FocusPreferencesForm } from '@/features/settings/components/FocusPreferencesForm'
import { TimezoneSettings } from '@/features/settings/components/TimezoneSettings'

export function SettingsPage() {
  return (
    <section className="flex flex-col gap-6">
      <h1 className="page-title">Configurações</h1>
      <FocusPreferencesForm />
      <TimezoneSettings />
    </section>
  )
}
