import { useEffect, useMemo, useState } from "react"
import { IconCheck, IconLock, IconPuzzle } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

export type BundledModEntry = {
  fileName: string
  displayName: string
  required: boolean
}

type StepModsProps = {
  onModsChange: (files: string[]) => void
}

export function StepMods({ onModsChange }: StepModsProps) {
  const [mods, setMods] = useState<BundledModEntry[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const list = (await window.electronAPI?.listBundledMods?.()) ?? []
      if (cancelled) return
      const entries = Array.isArray(list) ? list : []
      setMods(entries)
      // Select required mods by default; leave optional ones unselected.
      const initial = new Set<string>()
      for (const m of entries) if (m.required) initial.add(m.fileName)
      setSelected(initial)
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    onModsChange(Array.from(selected))
  }, [selected, onModsChange])

  const toggle = (entry: BundledModEntry) => {
    if (entry.required) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(entry.fileName)) next.delete(entry.fileName)
      else next.add(entry.fileName)
      return next
    })
  }

  const required = mods.filter((m) => m.required)
  const optional = mods.filter((m) => !m.required)
  const selectedCount = useMemo(() => selected.size, [selected])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Моды</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Выбери моды, которые будут установлены сразу. Обязательные всегда устанавливаются.
          </p>
        </div>
        {!loading && (
          <div className="flex items-center gap-2">
            {optional.length > 0 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelected(new Set(optional.map((m) => m.fileName).concat(Array.from(selected).filter((f) => required.some((r) => r.fileName === f)))))}
                  className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  Выбрать всё
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(new Set(required.map((m) => m.fileName)))}
                  className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  Снять всё
                </button>
              </div>
            )}
            <span className="text-xs text-muted-foreground">Выбрано: {selectedCount}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Загрузка списка модов...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {[...required, ...optional].map((entry) => {
            const isOn = selected.has(entry.fileName)
            return (
              <button
                key={entry.fileName}
                type="button"
                onClick={() => toggle(entry)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-150",
                  entry.required
                    ? "border-primary/40 bg-primary/5"
                    : isOn
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50",
                  !entry.required && "cursor-pointer",
                )}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    entry.required ? "bg-primary/20 text-primary" : isOn ? "bg-primary/20 text-primary" : "bg-white/[0.06] text-muted-foreground",
                  )}
                >
                  {entry.required ? <IconLock className="h-4 w-4" strokeWidth={1.8} /> : <IconPuzzle className="h-4 w-4" strokeWidth={1.8} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{entry.displayName}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {entry.required ? "Обязательный мод" : entry.fileName}
                  </p>
                </div>
                <div
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                    isOn ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
                  )}
                >
                  {isOn && <IconCheck className="h-3.5 w-3.5" strokeWidth={2.5} />}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
