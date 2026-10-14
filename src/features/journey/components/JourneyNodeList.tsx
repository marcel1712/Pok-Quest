import { ENCOUNTER_LABELS } from '@/features/battles/labels'
import type { EncounterKind } from '@/features/battles/types'
import type { JourneyNode, JourneyNodeStatus } from '../types'

const STATUS_LABELS: Record<JourneyNodeStatus, string> = {
  locked: 'Bloqueado',
  available: 'Em andamento',
  completed: 'Concluído',
}

const STATUS_STYLES: Record<JourneyNodeStatus, string> = {
  locked: 'border-line opacity-60',
  available: 'border-accent/60',
  completed: 'border-line-strong',
}

export function JourneyNodeList({
  journey,
  objectiveNodeId,
}: {
  journey: JourneyNode[]
  objectiveNodeId: string | null
}) {
  return (
    <ol aria-label="Etapas da jornada" className="flex flex-col gap-3">
      {journey.map(({ node, status, victories }) => {
        const encounter = ENCOUNTER_LABELS[node.encounter_kind as EncounterKind]
        const isObjective = node.id === objectiveNodeId

        return (
          <li
            key={node.id}
            aria-current={isObjective ? 'step' : undefined}
            className={`flex gap-3 rounded-control border p-4 ${STATUS_STYLES[status]}`}
          >
            <span className="text-2xl" aria-hidden="true">
              {status === 'locked' ? '🔒' : encounter.glyph}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <h2 className="font-semibold text-ink">{node.title}</h2>
                <span className="text-xs text-ink-muted">
                  {isObjective ? 'Próximo encontro' : STATUS_LABELS[status]}
                </span>
              </div>
              {status !== 'locked' && <p className="text-sm text-ink-muted">{node.summary}</p>}
              <p className="text-xs text-ink-muted">
                {encounter.label}
                {node.npc_name && status !== 'locked' ? ` · ${node.npc_name}` : ''} · dificuldade{' '}
                {node.encounter_difficulty}/5
                {status !== 'locked' &&
                  ` · ${Math.min(victories, node.required_victories)}/${node.required_victories} ${
                    node.required_victories === 1 ? 'vitória' : 'vitórias'
                  }`}
                {status === 'completed' && node.repeatable && ' · pode ser explorada de novo'}
              </p>
              {node.badge_name && (
                <p className="text-xs text-warning">
                  {status === 'completed' ? 'Conquistada: ' : 'Recompensa: '}
                  {node.badge_name}
                </p>
              )}
              {status !== 'locked' && node.scene_intro.length > 0 && (
                <details className="text-sm text-ink-soft">
                  <summary className="cursor-pointer text-xs text-accent-soft">Rever cena</summary>
                  <div className="mt-2 flex flex-col gap-1">
                    {[...node.scene_intro, ...(status === 'completed' ? node.scene_outro : [])].map(
                      (line) => (
                        <p key={line}>{line}</p>
                      ),
                    )}
                  </div>
                </details>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
