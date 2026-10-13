import { SpeciesCatalogGrid } from '@/features/pokemon/components/SpeciesCatalogGrid'

export function TeamPage() {
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-100">Equipe</h1>

      <p className="text-slate-400">
        Time ativo e box de capturados aparecerão aqui quando a captura existir (Fase 4, próxima
        etapa). Por enquanto, o catálogo de espécies conhecidas:
      </p>

      <SpeciesCatalogGrid />
    </section>
  )
}
