import { render } from '@testing-library/react'
import { BarChart } from './BarChart'
import { FlowChart } from './FlowChart'
import { PieChart, PIE_COLORS } from './PieChart'
import { labelIndices, niceScale, niceStep } from './scale'

describe('échelles', () => {
  it('pas « rond »', () => {
    expect([0.2, 1, 3, 7, 130, 2600, 9000].map(niceStep)).toEqual([1, 1, 5, 10, 200, 5000, 10000])
  })

  it('graduations de 0 à un maximum rond', () => {
    expect(niceScale(24000)).toEqual({ step: 10000, top: 30000, values: [0, 10000, 20000, 30000] })
    expect(niceScale(0).values[0]).toBe(0)
  })

  it('étiquettes espacées, premier et dernier toujours présents', () => {
    const picked = labelIndices(40, 6)
    expect(picked.has(0) && picked.has(39)).toBe(true)
    expect(picked.size).toBeLessThanOrEqual(8)
    expect([...labelIndices(5, 6)]).toEqual([0, 1, 2, 3, 4])
  })
})

describe('camembert', () => {
  const slices = [{ label: 'Alimentation', value: 30, share: 50 }, { label: 'Transport', value: 20, share: 33.3 }, { label: 'Loisirs', value: 10, share: 16.7 }]

  it('une part par budget, couleurs de la charte, légende « montant · pourcentage »', () => {
    const { container, getByText } = render(<PieChart slices={slices} />)
    const paths = [...container.querySelectorAll('path')]
    expect(paths.map((p) => p.getAttribute('fill'))).toEqual(PIE_COLORS.slice(0, 3))
    expect(getByText('30 Ar · 50,0 %')).toBeInTheDocument()   // RTL normalise les espaces insécables
    expect(container.querySelector('svg')).toHaveAccessibleName(/Alimentation 50,0\s%/)
  })

  it('un seul budget : disque plein', () => {
    const { container } = render(<PieChart slices={[{ label: 'Seul', value: 5, share: 100 }]} />)
    expect(container.querySelectorAll('circle')).toHaveLength(1)
    expect(container.querySelectorAll('path')).toHaveLength(0)
  })
})

describe('courbes', () => {
  const week = ['14 oct.', '15 oct.', '16 oct.', '17 oct.', '18 oct.', '19 oct.', '20 oct.'].map((label, i) => ({ label, deposits: 0, expenses: [24000, 12000, 0, 5000, 0, 5000, 14000][i]! }))

  it('deux courbes, un point par jour et par série, valeurs affichées si peu de jours', () => {
    const { container } = render(<FlowChart points={week} />)
    expect(container.querySelectorAll('polyline')).toHaveLength(2)
    expect(container.querySelectorAll('circle')).toHaveLength(14)
    const texts = [...container.querySelectorAll('text')].map((t) => t.textContent)
    expect(texts).toContain('24\u00a0000')
    expect(texts).toContain('14 oct.')
  })

  it('longue période : dates espacées et plus de valeurs sur les points', () => {
    const many = Array.from({ length: 90 }, (_, i) => ({ label: `j${i}`, deposits: i % 7, expenses: i % 5 }))
    const { container } = render(<FlowChart points={many} />)
    expect([...container.querySelectorAll('text')].length).toBeLessThan(25)
  })

  it('un seul jour : pas de ligne, deux points', () => {
    const { container } = render(<FlowChart points={[{ label: '1 oct.', deposits: 0, expenses: 500 }]} />)
    expect(container.querySelectorAll('polyline')).toHaveLength(0)
    expect(container.querySelectorAll('circle')).toHaveLength(2)
  })
})

describe('barres', () => {
  it('les jours au-dessus du budget retenu passent en orange, les jours sans dépense n\'ont pas de barre', () => {
    const bars = [{ label: 'a', value: 3000 }, { label: 'b', value: 0 }, { label: 'c', value: 1000 }]
    const { container } = render(<BarChart bars={bars} mean={1333} budget={2000} />)
    expect([...container.querySelectorAll('rect')].map((r) => r.getAttribute('fill'))).toEqual(['#f28c28', '#217346'])
    expect(container.querySelector('line[stroke-dasharray]')).not.toBeNull()
  })

  it('sans budget retenu : pas de ligne pointillée', () => {
    const { container } = render(<BarChart bars={[{ label: 'a', value: 100 }]} mean={100} budget={null} />)
    expect(container.querySelector('line[stroke-dasharray]')).toBeNull()
  })
})
