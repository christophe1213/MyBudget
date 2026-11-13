import { PageTitle, Segmented } from '@/ui/components/ui'
import { useNavigation, type BudgetsSection } from '@/ui/context'
import { AnalysisSection } from './AnalysisSection'
import { CategoriesSection } from './CategoriesSection'
import { PlanSection } from './PlanSection'

const SECTIONS: readonly { value: BudgetsSection; label: string }[] = [
  { value: 'categories', label: 'Catégories' },
  { value: 'plan', label: 'Planifier' },
  { value: 'analysis', label: 'Analyser' },
]

export function BudgetsPage() {
  const { budgetsSection, setBudgetsSection } = useNavigation()
  return (
    <div className="space-y-4">
      <PageTitle title="Budgets" subtitle="Vos catégories, la planification et l'analyse" />
      <Segmented label="Section des budgets" value={budgetsSection} onChange={setBudgetsSection} options={SECTIONS} />
      {budgetsSection === 'categories' && <CategoriesSection />}
      {budgetsSection === 'plan' && <PlanSection />}
      {budgetsSection === 'analysis' && <AnalysisSection />}
    </div>
  )
}
