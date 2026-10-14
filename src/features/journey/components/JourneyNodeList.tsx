import { ENCOUNTER_LABELS } from '@/features/battles/labels'
import type { EncounterKind } from '@/features/battles/types'
import type { JourneyNode, JourneyNodeStatus } from '../types'

const STATUS_LABELS: Record<JourneyNodeStatus, string> = {
  locked: 'Bloqueado',
  available: 'Em andamento',
  completed: 'Concluído',
}

const STATUS_STYLES: Record<JourneyNodeStatus, string> = {
  locked: 'border-slate-800 opacity-60',
  available: 'border-emerald-500/60',
  completed: 'border-slate-700',
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
            className={`flex gap-3 rounded border p-4 ${STATUS_STYLES[status]}`}
          >
            <span className="text-2xl" aria-hidden="true">
              {status === 'locked' ? '🔒' : encounter.glyph}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <h2 className="font-semibold text-slate-100">{node.title}</h2>
                <span className="text-xs text-slate-400">
                  {isObjective ? 'Próximo encontro' : STATUS_LABELS[status]}
                </span>
              </div>
              {status !== 'locked' && <p className="text-sm text-slate-400">{node.summary}</p>}
              <p className="text-xs text-slate-500">
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
                <p className="text-xs text-amber-300">
                  {status === 'completed' ? 'Conquistada: ' : 'Recompensa: '}
                  {node.badge_name}
                </p>
              )}
              {status !== 'locked' && node.scene_intro.length > 0 && (
                <details className="text-sm text-slate-300">
                  <summary className="cursor-pointer text-xs text-emerald-400">Rever cena</summary>
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
