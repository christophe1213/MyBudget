/** Parcours utilisateur dans la vraie interface (React + Tailwind), avec des adaptateurs en mémoire. */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { activeWallet } from '@/domain/workspace'
import { createTestService } from '@/test/fakes'
import { App } from './App'

/** Texte lisible d'un bloc : les éléments voisins (libellé puis valeur) sont séparés par une espace, comme à l'écran. */
function text(el: HTMLElement | null): string {
  const parts: string[] = []
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) parts.push(node.textContent ?? '')
    else node.childNodes.forEach(walk)
  }
  if (el) walk(el)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

function setup(day = '2026-10-14', prepare?: (s: ReturnType<typeof createTestService>['service']) => void) {
  const ctx = createTestService(day)
  prepare?.(ctx.service)
  const user = userEvent.setup()
  render(<App service={ctx.service} />)
  const goTo = (label: RegExp | string) => user.click(within(screen.getByRole('navigation', { name: 'Navigation principale' })).getByRole('button', { name: label }))
  return { ...ctx, user, goTo }
}

const seed = (s: ReturnType<typeof createTestService>['service']) => {
  ;['Alimentation', 'Électricité', 'Imprévus', 'Loisirs', 'Transport'].forEach((c) => s.addCategory(c))
  const add = (date: string, category: string, kind: 'expense' | 'deposit', amount: number, label = '') => s.addTransaction({ date, category, kind, label, amount })
  add('2026-10-14', 'Alimentation', 'deposit', 30000)
  add('2026-10-14', 'Transport', 'deposit', 20000)
  add('2026-10-14', 'Électricité', 'deposit', 20000)
  add('2026-10-14', 'Loisirs', 'deposit', 10000)
  add('2026-10-14', 'Imprévus', 'deposit', 10000)
  add('2026-10-15', 'Alimentation', 'expense', 12000, 'marché')
  add('2026-10-20', 'Électricité', 'expense', 4000, 'Jirama')
  add('2026-10-20', 'Imprévus', 'expense', 14000, 'panne')
}

describe('navigation', () => {
  it('cinq onglets, l\'onglet courant est signalé, le portefeuille ouvert est visible en haut', async () => {
    const { goTo } = setup()
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' })
    expect(within(nav).getAllByRole('button')).toHaveLength(5)
    expect(within(nav).getByRole('button', { name: /Accueil/ })).toHaveAttribute('aria-current', 'page')
    await goTo(/Saisie/)
    expect(within(nav).getByRole('button', { name: /Saisie/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: /Portefeuille ouvert : Principal/ })).toBeInTheDocument()
  })
})

describe('premier lancement : de la catégorie au tableau de bord', () => {
  it('créer des catégories, saisir un dépôt puis une dépense, voir le camembert', async () => {
    const { user, goTo, service } = setup()
    expect(screen.getByText('Aucun solde positif pour le moment')).toBeInTheDocument()

    await goTo(/Saisie/)
    expect(screen.getByText("Créez d'abord une catégorie")).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ajouter une catégorie' }))   // renvoie vers Budgets
    for (const name of ['Alimentation', 'Transport']) {
      await user.click(screen.getByRole('button', { name: '+ Nouvelle' }))
      await user.type(within(screen.getByRole('dialog', { name: 'Nouvelle catégorie' })).getByLabelText('Nom'), name)
      await user.click(screen.getByRole('button', { name: 'Ajouter' }))
      expect((await screen.findAllByText('Catégorie ajoutée')).length).toBeGreaterThan(0)   // la 1re notification peut encore être visible
    }

    await goTo(/Saisie/)
    await user.click(screen.getByRole('radio', { name: 'Dépôt' }))
    await user.type(screen.getByLabelText('Montant (Ar)'), '30000')
    expect(screen.getByLabelText('Montant (Ar)')).toHaveValue('30\u00a0000')           // milliers séparés pendant la saisie
    await user.click(screen.getByRole('button', { name: 'Ajouter le dépôt' }))
    expect(await screen.findByText('Dépôt ajouté')).toBeInTheDocument()
    expect(screen.getByLabelText('Montant (Ar)')).toHaveValue('')

    await user.click(screen.getByRole('radio', { name: 'Dépense' }))
    await user.type(screen.getByLabelText('Montant (Ar)'), '12000')
    await user.type(screen.getByLabelText('Libellé (facultatif)'), 'marché')
    await user.click(screen.getByRole('button', { name: 'Ajouter la dépense' }))
    expect(await screen.findByText('Dépense ajoutée')).toBeInTheDocument()
    expect(text(screen.getByRole('region', { name: 'Transactions du jour' }))).toContain('− 12 000 Ar')
    expect(text(screen.getByRole('region', { name: 'Transactions du jour' }))).toContain('Solde à cette date : 18 000 Ar')

    await goTo(/Accueil/)
    expect(text(screen.getByRole('region', { name: 'Solde total' }))).toContain('18 000 Ar')
    expect(text(screen.getByRole('region', { name: 'Répartition des budgets restants' }))).toContain('18 000 Ar · 100,0 %')
    expect(activeWallet(service.getSnapshot()).transactions).toHaveLength(2)
  })

  it('montant vide ou nul : message d\'erreur, rien n\'est enregistré', async () => {
    const { user, goTo, service } = setup('2026-10-14', (s) => s.addCategory('riz'))
    await goTo(/Saisie/)
    await user.click(screen.getByRole('button', { name: 'Ajouter la dépense' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Entrez un montant entier supérieur à 0.')
    expect(activeWallet(service.getSnapshot()).transactions).toHaveLength(0)
  })
})

describe('tableau de bord : filtre entre deux dates', () => {
  it('restreint les entrées et sorties à la période choisie', async () => {
    setup('2026-10-20', seed)
    const flows = screen.getByRole('region', { name: 'Entrées et sorties selon les dates' })
    expect(text(flows)).toContain('Sorties · 30 000 Ar')                    // 14 jours par défaut : tout est inclus
    fireEvent.change(within(flows).getByLabelText('Du'), { target: { value: '2026-10-15' } })
    fireEvent.change(within(flows).getByLabelText('Au'), { target: { value: '2026-10-17' } })
    expect(text(flows)).toContain('Entrées · 0 Ar')
    expect(text(flows)).toContain('Sorties · 12 000 Ar')
    expect(text(flows)).toContain('Le 15 octobre : Alimentation 12 000 Ar.')
    expect(within(flows).getByRole('img', { name: 'Entrées et sorties sur 3 jour(s)' })).toBeInTheDocument()
  })

  it('une période inversée affiche l\'erreur et garde le dernier graphique valide', () => {
    setup('2026-10-20', seed)
    const flows = screen.getByRole('region', { name: 'Entrées et sorties selon les dates' })
    fireEvent.change(within(flows).getByLabelText('Du'), { target: { value: '2026-10-15' } })
    fireEvent.change(within(flows).getByLabelText('Au'), { target: { value: '2026-10-10' } })
    expect(within(flows).getByRole('alert')).toHaveTextContent('La date de fin doit être postérieure à la date de début.')
    expect(text(flows)).toContain('Sorties · 30 000 Ar')                    // le graphique n'est pas vidé pendant la saisie
  })

  it('les raccourcis 7 j et Tout', async () => {
    const { user } = setup('2026-10-20', seed)
    const flows = screen.getByRole('region', { name: 'Entrées et sorties selon les dates' })
    await user.click(within(flows).getByRole('button', { name: '7 j' }))
    expect(within(flows).getByLabelText('Du')).toHaveValue('2026-10-14')
    expect(within(flows).getByLabelText('Au')).toHaveValue('2026-10-20')
    fireEvent.change(within(flows).getByLabelText('Du'), { target: { value: '2026-10-19' } })
    expect(text(flows)).toContain('Sorties · 18 000 Ar')
    await user.click(within(flows).getByRole('button', { name: 'Tout' }))
    expect(text(flows)).toContain('Sorties · 30 000 Ar')
  })

  it('le camembert signale la catégorie en déficit', () => {
    setup('2026-10-20', seed)
    const pie = screen.getByRole('region', { name: 'Répartition des budgets restants' })
    expect(text(pie)).toContain('Les 4 000 Ar en déficit (Imprévus) ne font pas partie du camembert.')
    expect(text(pie)).toContain('Transport')
  })
})

describe('saisie : transactions du jour', () => {
  it('supprimer une transaction demande confirmation', async () => {
    const { user, goTo, service } = setup('2026-10-14', (s) => {
      s.addCategory('riz')
      s.addTransaction({ date: '2026-10-14', category: 'riz', kind: 'expense', label: 'marché', amount: 500 })
    })
    await goTo(/Saisie/)
    await user.click(screen.getByRole('button', { name: 'Supprimer marché' }))
    const dialog = screen.getByRole('dialog', { name: 'Supprimer cette transaction ?' })
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }))
    expect(activeWallet(service.getSnapshot()).transactions).toHaveLength(1)           // annulé : rien ne bouge
    await user.click(screen.getByRole('button', { name: 'Supprimer marché' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }))
    expect(await screen.findByText('Transaction supprimée')).toBeInTheDocument()
    expect(screen.getByText('Aucune transaction ce jour-là.')).toBeInTheDocument()
  })

  it('navigation de jour en jour', async () => {
    const { user, goTo } = setup('2026-10-14', seed)
    await goTo(/Saisie/)
    const day = screen.getByRole('region', { name: 'Transactions du jour' })
    expect(within(day).getByRole('heading')).toHaveTextContent('mercredi 14 octobre 2026')
    await user.click(within(day).getByRole('button', { name: 'Jour suivant' }))
    expect(within(day).getByRole('heading')).toHaveTextContent('jeudi 15 octobre 2026')
    expect(text(day)).toContain('marché')
  })
})

describe('budgets', () => {
  it('catégorie : régler le budget par jour, renommer, et la suppression est refusée si elle est utilisée', async () => {
    const { user, goTo, service } = setup('2026-10-14', seed)
    await goTo(/Budgets/)
    await user.click(screen.getByRole('button', { name: /Transport/ }))
    const sheet = screen.getByRole('dialog', { name: 'Transport' })
    await user.type(within(sheet).getByLabelText('Budget par jour (Ar)'), '3700')
    await user.clear(within(sheet).getByLabelText('Nom'))
    await user.type(within(sheet).getByLabelText('Nom'), 'Transports')
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText('Catégorie enregistrée')).toBeInTheDocument()
    const renamed = activeWallet(service.getSnapshot()).categories.find((c) => c.name === 'Transports')
    expect(renamed?.dailyBudget).toBe(3700)
    expect(activeWallet(service.getSnapshot()).transactions.some((t) => t.category === 'Transports')).toBe(true)

    await user.click(screen.getByRole('button', { name: /Alimentation/ }))
    const used = screen.getByRole('dialog', { name: 'Alimentation' })
    expect(within(used).getByRole('button', { name: 'Supprimer la catégorie' })).toBeDisabled()
    expect(text(used)).toContain('Utilisée par 2 transaction(s)')
  })

  it('planifier : la suggestion se calcule, le montant retenu est ajustable, les dépôts sont créés', async () => {
    const { user, goTo, service } = setup('2026-10-01', (s) => {
      s.addCategory('Gouter')
      s.addTransaction({ date: '2026-09-30', category: 'Gouter', kind: 'deposit', label: '', amount: 3000 })
      s.addTransaction({ date: '2026-09-30', category: 'Gouter', kind: 'expense', label: '', amount: 2000 })
    })
    await goTo(/Budgets/)
    await user.click(screen.getByRole('radio', { name: 'Planifier' }))
    expect(screen.getByLabelText('Du')).toHaveValue('2026-10-01')               // lendemain de la dernière transaction
    expect(screen.getByLabelText('Au')).toHaveValue('2026-10-07')               // 7 jours

    await user.click(screen.getByRole('button', { name: /Budget \/ jour : 0/ }))   // définir 500 Ar / jour
    await user.type(within(screen.getByRole('dialog', { name: 'Gouter' })).getByLabelText('Budget par jour (Ar)'), '500')
    await user.click(within(screen.getByRole('dialog', { name: 'Gouter' })).getByRole('button', { name: 'Enregistrer' }))

    const lines = screen.getByRole('region', { name: 'Budgets proposés' })
    expect(text(lines)).toContain('7 jour(s) → 3 500 Ar · solde disponible 1 000 Ar')
    const retained = within(lines).getByLabelText('Montant retenu pour Gouter')
    expect(retained).toHaveValue('2\u00a0500')                                   // 7 × 500 − 1 000
    await user.clear(retained)
    await user.type(retained, '3000')                                             // l'utilisateur ajuste à 3 000
    expect(text(lines)).toContain('Total suggéré 2 500 Ar')
    expect(text(lines)).toContain('Total retenu 3 000 Ar')

    await user.click(within(lines).getByRole('button', { name: 'Valider et créer les dépôts' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Créer les dépôts ?' })).getByRole('button', { name: 'Créer les dépôts' }))
    expect(await screen.findByText(/1 dépôt\(s\) créé\(s\)/)).toBeInTheDocument()
    expect(activeWallet(service.getSnapshot()).transactions.at(-1)).toMatchObject({ kind: 'deposit', amount: 3000, date: '2026-10-01', label: 'Budget du 01/10/2026 au 07/10/2026' })

    // Les mêmes dépôts une seconde fois : une confirmation supplémentaire protège du doublon.
    await user.click(within(lines).getByRole('button', { name: 'Valider et créer les dépôts' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Créer les dépôts' }))
    expect(screen.getByRole('dialog', { name: 'Budget déjà validé' })).toBeInTheDocument()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Annuler' }))
    expect(activeWallet(service.getSnapshot()).transactions.filter((t) => t.label.startsWith('Budget du'))).toHaveLength(1)
  })

  it('analyser : statistiques, niveaux proposés, enregistrement du budget par jour', async () => {
    const { user, goTo, service } = setup('2026-09-04', (s) => {
      s.addCategory('bazar')
      s.addTransaction({ date: '2026-09-01', category: 'bazar', kind: 'expense', label: '', amount: 3000 })
      s.addTransaction({ date: '2026-09-03', category: 'bazar', kind: 'expense', label: '', amount: 1000 })
    })
    await goTo(/Budgets/)
    await user.click(screen.getByRole('radio', { name: 'Analyser' }))
    const results = screen.getByRole('region', { name: "Résultats de l'analyse" })
    expect(text(results)).toContain('Moyenne par jour 1 333 Ar')
    expect(text(results)).toContain('Jours avec dépense 2 / 3')
    const levels = screen.getByRole('region', { name: 'Budget par jour proposé' })
    expect(within(levels).getByLabelText('Budget par jour retenu (Ar)')).toHaveValue('1\u00a0300')      // la moyenne par défaut
    await user.click(within(levels).getByRole('button', { name: /Confortable/ }))
    expect(within(levels).getByLabelText('Budget par jour retenu (Ar)')).toHaveValue('2\u00a0900')
    await user.click(within(levels).getByRole('button', { name: 'Enregistrer comme budget / jour' }))
    expect(activeWallet(service.getSnapshot()).categories[0]!.dailyBudget).toBe(2900)
    expect(screen.getByRole('img', { name: 'Dépenses de chacun des 3 jours' })).toBeInTheDocument()
  })
})

describe('rapport', () => {
  it('résumé, parts par catégorie et plus grosses dépenses', async () => {
    const { goTo } = setup('2026-10-20', seed)
    await goTo(/Rapport/)
    const summary = screen.getByRole('region', { name: 'Résumé de la période' })
    expect(text(summary)).toContain('Total des dépôts 90 000 Ar')
    expect(text(summary)).toContain('Total des dépenses 30 000 Ar')
    expect(text(summary)).toContain('Solde à la fin 60 000 Ar')
    const categories = screen.getByRole('region', { name: 'Totaux par catégorie' })
    expect(text(categories)).toContain('46,7 % des dépenses')                          // Imprévus : 14 000 / 30 000
    expect(text(screen.getByRole('region', { name: 'Plus grosses dépenses' }))).toContain('panne')
  })
})

describe('réglages : portefeuilles et données', () => {
  it('créer un portefeuille puis changer de portefeuille depuis le haut de l\'écran', async () => {
    const { user, goTo, service } = setup('2026-10-14', (s) => s.addCategory('riz'))
    await goTo(/Réglages/)
    await user.click(screen.getByRole('button', { name: '+ Nouveau' }))
    await user.type(within(screen.getByRole('dialog', { name: 'Nouveau portefeuille' })).getByLabelText('Nom'), 'Banque')
    await user.click(screen.getByRole('button', { name: 'Créer' }))
    expect(await screen.findByText('Portefeuille créé')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Portefeuille ouvert : Banque/ })).toBeInTheDocument()
    expect(activeWallet(service.getSnapshot()).categories).toEqual([])                  // chaque portefeuille a ses données

    await user.click(screen.getByRole('button', { name: /Portefeuille ouvert : Banque/ }))
    await user.click(within(screen.getByRole('dialog', { name: 'Changer de portefeuille' })).getByRole('button', { name: /Principal/ }))
    expect(screen.getByRole('button', { name: /Portefeuille ouvert : Principal/ })).toBeInTheDocument()
    expect(activeWallet(service.getSnapshot()).categories.map((c) => c.name)).toEqual(['riz'])
  })

  it('exporter le JSON', async () => {
    const { user, goTo, files } = setup('2026-10-14', seed)
    await goTo(/Réglages/)
    await user.click(screen.getByRole('button', { name: /Exporter \(JSON\)/ }))
    expect(await screen.findByText('Sauvegarde téléchargée : repere-sauvegarde-2026-10-14.json')).toBeInTheDocument()
    expect(files.downloads).toHaveLength(1)
    expect(JSON.parse(files.downloads[0]!.content)).toMatchObject({ format: 'repere', version: 1 })
  })

  it('importer un JSON : aperçu, puis remplacer les données', async () => {
    const source = createTestService('2026-10-14')
    seed(source.service)
    source.service.exportBackup()
    const { user, goTo, files, service } = setup('2026-10-14')
    files.next = { name: 'ma-sauvegarde.json', text: source.files.downloads[0]!.content }
    await goTo(/Réglages/)
    await user.click(screen.getByRole('button', { name: /Importer \(JSON\)/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Importer une sauvegarde' })
    expect(text(sheet)).toContain('Fichier « ma-sauvegarde.json » : 1 portefeuille(s), 8 transaction(s).')
    expect(activeWallet(service.getSnapshot()).transactions).toHaveLength(0)             // l'aperçu ne modifie rien
    await user.click(within(sheet).getByRole('radio', { name: 'Remplacer' }))
    await user.click(within(sheet).getByRole('button', { name: 'Remplacer mes données' }))
    expect(await screen.findByText('Données remplacées')).toBeInTheDocument()
    expect(activeWallet(service.getSnapshot()).transactions).toHaveLength(8)
  })

  it('importer en ajoutant : les portefeuilles existants sont conservés', async () => {
    const source = createTestService('2026-10-14')
    seed(source.service)
    source.service.exportBackup()
    const { user, goTo, files, service } = setup('2026-10-14', (s) => s.addCategory('riz'))
    files.next = { name: 'a.json', text: source.files.downloads[0]!.content }
    await goTo(/Réglages/)
    await user.click(screen.getByRole('button', { name: /Importer \(JSON\)/ }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Importer une sauvegarde' })).getByRole('button', { name: 'Ajouter ces portefeuilles' }))
    await waitFor(() => expect(service.getSnapshot().wallets.map((w) => w.name)).toEqual(['Principal', 'Principal (2)']))
    expect(activeWallet(service.getSnapshot()).categories.map((c) => c.name)).toEqual(['riz'])
  })

  it('un fichier invalide est refusé avec un message clair', async () => {
    const { user, goTo, files, service } = setup('2026-10-14')
    files.next = { name: 'mauvais.json', text: '{"format":"repere","version":1,"wallets":[{"name":"X","transactions":[{"date":"2026-02-30","category":"a","kind":"expense","amount":5}]}]}' }
    await goTo(/Réglages/)
    await user.click(screen.getByRole('button', { name: /Importer \(JSON\)/ }))
    expect(await screen.findByText(/transaction n°1 : date invalide/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Importer une sauvegarde' })).not.toBeInTheDocument()
    expect(service.getSnapshot().wallets).toHaveLength(1)
  })

  it('tout effacer demande confirmation', async () => {
    const { user, goTo, service } = setup('2026-10-14', seed)
    await goTo(/Réglages/)
    await user.click(screen.getByRole('button', { name: 'Tout effacer' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Tout effacer ?' })).getByRole('button', { name: 'Annuler' }))
    expect(activeWallet(service.getSnapshot()).transactions).toHaveLength(8)
    await user.click(screen.getByRole('button', { name: 'Tout effacer' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Tout effacer ?' })).getByRole('button', { name: 'Tout effacer' }))
    expect(await screen.findByText('Toutes les données ont été effacées')).toBeInTheDocument()
    expect(activeWallet(service.getSnapshot()).transactions).toHaveLength(0)
  })

  it('solde initial', async () => {
    const { user, goTo, service } = setup()
    await goTo(/Réglages/)
    await user.type(screen.getByLabelText('Montant (Ar)'), '16600')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText('Solde initial enregistré')).toBeInTheDocument()
    expect(activeWallet(service.getSnapshot()).initialBalance).toBe(16600)
  })
})

describe('erreurs de stockage', () => {
  it('un espace plein est annoncé à l\'utilisateur et rien n\'est perdu', async () => {
    const { user, goTo, service, repository } = setup('2026-10-14', (s) => s.addCategory('riz'))
    const { StorageError } = await import('@/application/ports')
    repository.failWith = new StorageError('Espace de stockage plein : exportez vos données.', 'quota')
    await goTo(/Saisie/)
    await user.type(screen.getByLabelText('Montant (Ar)'), '500')
    await user.click(screen.getByRole('button', { name: 'Ajouter la dépense' }))
    expect(await screen.findByText(/Espace de stockage plein/)).toBeInTheDocument()
    expect(activeWallet(service.getSnapshot()).transactions).toHaveLength(0)
    expect(screen.getByLabelText('Montant (Ar)')).toHaveValue('500')                       // la saisie est conservée pour réessayer
  })

  it('l\'avertissement de démarrage s\'affiche et se ferme', async () => {
    const ctx = createTestService()
    ctx.service.setStartupWarning('Les données enregistrées étaient illisibles.')
    const user = userEvent.setup()
    render(<App service={ctx.service} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Les données enregistrées étaient illisibles.')
    await user.click(screen.getByRole('button', { name: 'Compris' }))
    expect(screen.queryByText('Les données enregistrées étaient illisibles.')).not.toBeInTheDocument()
  })
})
